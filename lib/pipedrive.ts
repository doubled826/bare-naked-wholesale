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
  additional_data?: {
    next_cursor?: string | null;
    pagination?: {
      more_items_in_collection?: boolean;
      next_start?: number;
    };
  };
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

type PipedriveUser = {
  id: number;
  name?: string | null;
};

type PipedriveDealChangelog = {
  field_key?: string | null;
  old_value?: string | number | null;
  new_value?: string | number | null;
  time?: string | null;
};

export interface PipedriveStageTransition {
  dealId: number;
  dealTitle: string;
  ownerName: string | null;
  fromStageId: number | null;
  toStageId: number;
  changedAt: string;
};

type PipedriveActivity = {
  id: number;
  subject?: string | null;
  type?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  duration?: string | null;
  note?: string | null;
  done?: boolean | number | string | null;
  deal_id?: number | null;
  deal_title?: string | null;
  person_id?: number | null;
  person_name?: string | null;
  org_id?: number | null;
  org_name?: string | null;
  owner_name?: string | null;
  assigned_to_user_id?: number | null;
  add_time?: string | null;
  update_time?: string | null;
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

export interface PipedriveActivitySummary {
  id: number;
  subject: string;
  type: string | null;
  dueDate: string | null;
  dueTime: string | null;
  duration: string | null;
  note: string | null;
  done: boolean;
  dealId: number | null;
  dealTitle: string | null;
  personId: number | null;
  personName: string | null;
  orgId: number | null;
  orgName: string | null;
  ownerName: string | null;
  addTime: string | null;
  updateTime: string | null;
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
  const payload = await pipedriveEnvelopeRequest<T>(path, init);
  return payload.data as T;
}

async function pipedriveEnvelopeRequest<T>(path: string, init?: RequestInit): Promise<PipedriveResponse<T>> {
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

  return payload;
}

async function pipedriveVersionedEnvelopeRequest<T>(
  version: 'v1' | 'v2',
  path: string,
  init?: RequestInit,
): Promise<PipedriveResponse<T>> {
  const { token, baseUrl } = getConfig();
  const versionedBaseUrl = baseUrl.replace(/\/v\d+\/?$/, `/${version}`);
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${versionedBaseUrl}${path}${separator}api_token=${token}`, {
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

  return payload;
}

async function loadStageMap() {
  if (stageCache) {
    return stageCache;
  }

  const stages = await pipedriveRequest<PipedriveStage[]>('/stages?limit=500');
  stageCache = new Map(stages.map((stage) => [stage.id, stage.name]));
  return stageCache;
}

async function loadUserMap() {
  const users = await pipedriveRequest<PipedriveUser[]>('/users');
  return new Map(users.map((user) => [user.id, user.name?.trim() || 'Unknown owner']));
}

async function listUpdatedDeals(path: '/deals' | '/deals/archived', since: string, until: string) {
  const deals: PipedriveDeal[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({
      updated_since: since,
      updated_until: until,
      status: 'open,won,lost',
      limit: '500',
    });
    if (cursor) params.set('cursor', cursor);

    const payload = await pipedriveVersionedEnvelopeRequest<PipedriveDeal[]>('v2', `${path}?${params}`);
    deals.push(...(payload.data || []));
    cursor = payload.additional_data?.next_cursor || null;
  } while (cursor);

  return deals;
}

async function listDealChangelog(dealId: number) {
  const changes: PipedriveDealChangelog[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ limit: '500' });
    if (cursor) params.set('cursor', cursor);
    const payload = await pipedriveVersionedEnvelopeRequest<PipedriveDealChangelog[]>(
      'v1',
      `/deals/${dealId}/changelog?${params}`,
    );
    changes.push(...(payload.data || []));
    cursor = payload.additional_data?.next_cursor || null;
  } while (cursor);

  return changes;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function resolvePipedriveStageId(stageName: string, configuredId?: string) {
  if (configuredId) {
    const stageId = Number(configuredId);
    if (!Number.isInteger(stageId) || stageId <= 0) {
      throw new Error(`Invalid Pipedrive stage ID configured for ${stageName}.`);
    }
    return stageId;
  }

  const stageMap = await loadStageMap();
  const matches = Array.from(stageMap.entries()).filter(([, name]) => name.trim().toLowerCase() === stageName.toLowerCase());
  if (matches.length === 0) throw new Error(`Pipedrive stage not found: ${stageName}.`);
  if (matches.length > 1) {
    throw new Error(`Multiple Pipedrive stages are named ${stageName}. Configure its stage ID explicitly.`);
  }
  return matches[0][0];
}

export async function getPipedriveStageTransitionsSince(since: Date, until: Date) {
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();
  const [activeDeals, archivedDeals, userMap] = await Promise.all([
    listUpdatedDeals('/deals', sinceIso, untilIso),
    listUpdatedDeals('/deals/archived', sinceIso, untilIso),
    loadUserMap(),
  ]);
  const dealsById = new Map([...activeDeals, ...archivedDeals].map((deal) => [deal.id, deal]));
  const dealChanges = await mapWithConcurrency(Array.from(dealsById.values()), 6, async (deal) => ({
    deal,
    changes: await listDealChangelog(deal.id),
  }));

  return dealChanges.flatMap<PipedriveStageTransition>(({ deal, changes }) => {
    const ownerName = deal.owner_name ||
      (typeof deal.owner_id === 'object' ? deal.owner_id?.name || null : userMap.get(deal.owner_id || -1) || null);

    return changes.flatMap((change) => {
      if (change.field_key !== 'stage_id' || !change.time) return [];
      const toStageId = Number(change.new_value);
      if (!Number.isInteger(toStageId)) return [];
      return [{
        dealId: deal.id,
        dealTitle: deal.title,
        ownerName,
        fromStageId: change.old_value == null ? null : Number(change.old_value),
        toStageId,
        changedAt: change.time,
      }];
    });
  });
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

function toActivitySummary(activity: PipedriveActivity): PipedriveActivitySummary {
  return {
    id: activity.id,
    subject: activity.subject || 'Untitled activity',
    type: activity.type || null,
    dueDate: activity.due_date || null,
    dueTime: activity.due_time || null,
    duration: activity.duration || null,
    note: activity.note || null,
    done: activity.done === true || activity.done === 1 || activity.done === '1',
    dealId: activity.deal_id || null,
    dealTitle: activity.deal_title || null,
    personId: activity.person_id || null,
    personName: activity.person_name || null,
    orgId: activity.org_id || null,
    orgName: activity.org_name || null,
    ownerName: activity.owner_name || null,
    addTime: activity.add_time || null,
    updateTime: activity.update_time || null,
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

export async function listOverduePipedriveActivities(today: string, maxItems = 1000) {
  const activities: PipedriveActivity[] = [];
  let start = 0;
  const pageSize = 500;

  while (activities.length < maxItems) {
    const payload = await pipedriveEnvelopeRequest<PipedriveActivity[]>(
      `/activities?done=0&start=${start}&limit=${pageSize}`
    );
    activities.push(...(payload.data || []));

    const pagination = payload.additional_data?.pagination;
    if (!pagination?.more_items_in_collection || typeof pagination.next_start !== 'number') {
      break;
    }
    start = pagination.next_start;
  }

  return activities
    .map(toActivitySummary)
    .filter((activity) => activity.dueDate && activity.dueDate <= today && !activity.done)
    .sort((a, b) => {
      const dateDiff = (a.dueDate || '').localeCompare(b.dueDate || '');
      if (dateDiff !== 0) return dateDiff;
      return (a.dueTime || '').localeCompare(b.dueTime || '');
    })
    .slice(0, maxItems);
}

export async function completePipedriveActivity(activityId: number) {
  return pipedriveRequest<{ id: number; done?: boolean | number | string }>(`/activities/${activityId}`, {
    method: 'PUT',
    body: JSON.stringify({ done: 1 }),
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
