import crypto from 'crypto';

const META_EVENT_NAME = 'WholesaleLeadQualified';
const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

type SupabaseAdminClient = {
  from: (table: string) => any;
};

type WholesaleLead = {
  id: string;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  shipping_address_1?: string | null;
  shipping_address_2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postal_code?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  fbclid?: string | null;
  landing_page_url?: string | null;
  source?: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at?: string | null;
  qualified_at?: string | null;
  meta_qualified_event_id?: string | null;
  meta_qualified_event_sent_at?: string | null;
};

const getConfiguredValue = (keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return '';
};

const normalizeText = (value?: string | null) => value?.trim().toLowerCase().replace(/\s+/g, ' ') || '';

const normalizePhone = (value?: string | null) => {
  const digits = value?.replace(/\D/g, '') || '';
  if (digits.length === 10) return `1${digits}`;
  return digits;
};

const normalizeZip = (value?: string | null) => normalizeText(value).replace(/\s+/g, '');

const normalizeState = (value?: string | null) => normalizeText(value).replace(/[^a-z0-9]/g, '');

const normalizeCountry = (lead: WholesaleLead) => {
  const payloadCountry = lead.raw_payload?.country;
  const country = typeof payloadCountry === 'string' ? payloadCountry : '';
  const normalized = normalizeState(country);

  if (normalized === 'canada' || normalized === 'ca') return 'ca';
  return normalized || 'us';
};

const hash = (value?: string | null) => {
  const normalized = value || '';
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const splitName = (name?: string | null) => {
  const parts = normalizeText(name).split(' ').filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
};

const withDefinedValues = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));

const getEventId = (lead: WholesaleLead) => lead.meta_qualified_event_id || `${META_EVENT_NAME}:${lead.id}`;

const claimQualifiedEvent = async (adminClient: SupabaseAdminClient, lead: WholesaleLead) => {
  if (lead.meta_qualified_event_sent_at) return null;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString();
  const eventId = getEventId(lead);

  const { data, error } = await adminClient
    .from('wholesale_leads')
    .update({
      meta_qualified_event_id: eventId,
      meta_qualified_event_processing_at: now.toISOString(),
      meta_qualified_event_attempts: (lead as any).meta_qualified_event_attempts ? (lead as any).meta_qualified_event_attempts + 1 : 1,
      meta_qualified_event_last_error: null,
      updated_at: now.toISOString(),
    })
    .eq('id', lead.id)
    .is('meta_qualified_event_sent_at', null)
    .or(`meta_qualified_event_processing_at.is.null,meta_qualified_event_processing_at.lt.${staleBefore}`)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Meta qualified lead event claim error:', error);
    return null;
  }

  return data as WholesaleLead | null;
};

const releaseQualifiedEvent = async (adminClient: SupabaseAdminClient, leadId: string, errorMessage: string) => {
  await adminClient
    .from('wholesale_leads')
    .update({
      meta_qualified_event_processing_at: null,
      meta_qualified_event_last_error: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);
};

const markQualifiedEventSent = async (adminClient: SupabaseAdminClient, leadId: string) => {
  const now = new Date().toISOString();
  await adminClient
    .from('wholesale_leads')
    .update({
      meta_qualified_event_sent_at: now,
      meta_qualified_event_processing_at: null,
      meta_qualified_event_last_error: null,
      updated_at: now,
    })
    .eq('id', leadId)
    .is('meta_qualified_event_sent_at', null);
};

const buildQualifiedLeadPayload = (lead: WholesaleLead, pixelId: string) => {
  const { firstName, lastName } = splitName(lead.contact_name);
  const eventId = getEventId(lead);
  const eventTime = Math.floor(new Date(lead.qualified_at || Date.now()).getTime() / 1000);

  const userData = withDefinedValues({
    em: hash(normalizeText(lead.email)),
    ph: hash(normalizePhone(lead.phone)),
    fn: hash(firstName),
    ln: hash(lastName),
    ct: hash(normalizeText(lead.shipping_city).replace(/\s+/g, '')),
    st: hash(normalizeState(lead.shipping_state)),
    zp: hash(normalizeZip(lead.shipping_postal_code)),
    country: hash(normalizeCountry(lead)),
    external_id: hash(normalizeText(lead.id)),
    fbp: lead.fbp || undefined,
    fbc: lead.fbc || undefined,
    client_ip_address: lead.ip_address || undefined,
    client_user_agent: lead.user_agent || undefined,
  });

  const event = withDefinedValues({
    event_name: META_EVENT_NAME,
    event_time: eventTime,
    event_id: eventId,
    action_source: 'website',
    event_source_url: lead.landing_page_url || undefined,
    user_data: userData,
    custom_data: withDefinedValues({
      lead_source: lead.source || undefined,
      original_submission_time: lead.created_at || undefined,
      qualified_at: lead.qualified_at || undefined,
    }),
  });

  const payload: Record<string, unknown> = { data: [event] };
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();
  if (testEventCode) payload.test_event_code = testEventCode;

  return {
    url: `https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events`,
    payload,
  };
};

export const sendWholesaleLeadQualifiedEvent = async (adminClient: SupabaseAdminClient, lead: WholesaleLead) => {
  const pixelId = getConfiguredValue(['META_PIXEL_ID', 'FACEBOOK_PIXEL_ID']);
  const accessToken = getConfiguredValue(['META_CONVERSIONS_API_TOKEN', 'FACEBOOK_CONVERSIONS_API_TOKEN']);

  if (!pixelId || !accessToken) {
    return { sent: false, skipped: true, reason: 'Meta Conversions API is not configured.' };
  }

  const claimedLead = await claimQualifiedEvent(adminClient, lead);
  if (!claimedLead) {
    return { sent: false, skipped: true, reason: 'Qualified lead event was already sent or is currently being processed.' };
  }

  try {
    const { url, payload } = buildQualifiedLeadPayload(claimedLead, pixelId);
    const response = await fetch(`${url}?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const message = result?.error?.message || `Meta Conversions API returned ${response.status}.`;
      throw new Error(message);
    }

    await markQualifiedEventSent(adminClient, claimedLead.id);
    return { sent: true, skipped: false, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send Meta qualified lead event.';
    await releaseQualifiedEvent(adminClient, claimedLead.id, message);
    console.error('Meta qualified lead event send error:', error);
    return { sent: false, skipped: false, error: message };
  }
};
