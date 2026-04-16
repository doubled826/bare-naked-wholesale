const DEFAULT_BASE_URL = 'https://api.pipedrive.com/v1';

export const ONBOARDING_STAGE_NAMES = [
  'First Order Received',
  'Second Order Received',
  'Third Order Received',
] as const;

type PipedriveResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

type PipedriveStage = {
  id: number;
  name: string;
};

type PipedriveOwner = {
  name?: string;
};

type PipedriveOrg = {
  name?: string;
};

type PipedriveDeal = {
  id: number;
  title: string;
  stage_id?: number | null;
  owner_name?: string;
  owner_id?: PipedriveOwner | number | null;
  org_name?: string;
  org_id?: PipedriveOrg | number | null;
  add_time?: string | null;
  update_time?: string | null;
  status?: string | null;
};

export interface PipedriveDealSummary {
  id: number;
  title: string;
  stageId: number | null;
  stageName: string;
  ownerName: string | null;
  orgName: string | null;
  addTime: string | null;
  updateTime: string | null;
  status: string | null;
}

let stageCache: Map<number, string> | null = null;

function getConfig() {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  const baseUrl = process.env.PIPEDRIVE_BASE_URL || DEFAULT_BASE_URL;

  if (!token) {
    throw new Error('Pipedrive is not configured. Add PIPEDRIVE_API_TOKEN to the server environment.');
  }

  return { token, baseUrl };
}

async function pipedriveRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { token, baseUrl } = getConfig();
  const separator = path.includes('?') ? '&' : '?';
  const url = `${baseUrl}${path}${separator}api_token=${token}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => ({}))) as PipedriveResponse<T>;

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Pipedrive request failed.');
  }

  return payload.data as T;
}

async function loadStageMap() {
  if (stageCache) {
    return stageCache;
  }

  const stages = await pipedriveRequest<PipedriveStage[]>('/stages');
  stageCache = new Map(stages.map((stage) => [stage.id, stage.name]));
  return stageCache;
}

function toSummary(deal: PipedriveDeal, stageName: string): PipedriveDealSummary {
  const ownerName =
    deal.owner_name ||
    (typeof deal.owner_id === 'object' ? deal.owner_id?.name || null : null);
  const orgName =
    deal.org_name ||
    (typeof deal.org_id === 'object' ? deal.org_id?.name || null : null);

  return {
    id: deal.id,
    title: deal.title,
    stageId: deal.stage_id ?? null,
    stageName,
    ownerName,
    orgName,
    addTime: deal.add_time || null,
    updateTime: deal.update_time || null,
    status: deal.status || null,
  };
}

export async function searchPipedriveDeals(term: string) {
  const data = await pipedriveRequest<{ items?: { item: { id: number; title: string } }[] }>(
    `/deals/search?term=${encodeURIComponent(term)}&limit=10`
  );

  return (data.items || []).map((entry) => ({
    id: entry.item.id,
    title: entry.item.title,
  }));
}

export async function getPipedriveDeal(dealId: number) {
  const [deal, stageMap] = await Promise.all([
    pipedriveRequest<PipedriveDeal>(`/deals/${dealId}`),
    loadStageMap(),
  ]);

  return toSummary(deal, stageMap.get(deal.stage_id || -1) || 'Unknown Stage');
}

export async function addPipedriveNote(dealId: number, content: string) {
  return pipedriveRequest<{ id: number; content?: string }>('/notes', {
    method: 'POST',
    body: JSON.stringify({ deal_id: dealId, content }),
  });
}

export async function createPipedriveActivity(dealId: number, subject: string, dueDate: string) {
  return pipedriveRequest<{ id: number }>('/activities', {
    method: 'POST',
    body: JSON.stringify({ subject, type: 'call', deal_id: dealId, due_date: dueDate, done: 0 }),
  });
}

export async function updatePipedriveDealStage(dealId: number, stageName: string) {
  const stageMap = await loadStageMap();
  const stageEntry = Array.from(stageMap.entries()).find(([, name]) => name === stageName);

  if (!stageEntry) {
    throw new Error(`Unable to find Pipedrive stage "${stageName}".`);
  }

  const [stageId] = stageEntry;

  return pipedriveRequest<{ id: number; stage_id?: number }>(`/deals/${dealId}`, {
    method: 'PUT',
    body: JSON.stringify({ stage_id: stageId }),
  });
}

export function isOnboardingStage(stageName: string | null | undefined) {
  return !!stageName && ONBOARDING_STAGE_NAMES.includes(stageName as (typeof ONBOARDING_STAGE_NAMES)[number]);
}
