import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type LeadBody = Record<string, unknown>;

const BUYING_WHOLESALE_VALUES = new Set(['yes', 'no', 'opening_soon']);
const MAX_TEXT_LENGTH = 500;
const LOCATION_COUNT_KEYS = [
  'locationCount',
  'location_count',
  'locationsCount',
  'locations_count',
  'numberOfLocations',
  'number_of_locations',
  'numberOfStoreLocations',
  'number_of_store_locations',
  'storeLocationCount',
  'store_location_count',
  'storeLocations',
  'store_locations',
  'locations',
  'locationTotal',
  'location_total',
  'totalLocations',
  'total_locations',
];
const MESSAGE_KEYS = [
  'message',
  'notes',
  'note',
  'comments',
  'comment',
  'additionalNotes',
  'additional_notes',
  'additionalComments',
  'additional_comments',
  'anythingElse',
  'anything_else',
];
const LOCATION_COUNT_LABELS: Record<string, string> = {
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5+',
  '5+': '5+',
  '5_plus': '5+',
  '5 or more': '5+',
};

const getString = (body: LeadBody, keys: string[]) => {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed.slice(0, MAX_TEXT_LENGTH);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
};

const getOptionalString = (body: LeadBody, keys: string[]) => {
  const value = getString(body, keys);
  return value || null;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeBuyingWholesale = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/^opening$/, 'opening_soon');

  if (normalized === 'true') return 'yes';
  if (normalized === 'false') return 'no';
  return BUYING_WHOLESALE_VALUES.has(normalized) ? normalized : null;
};

const normalizeOptionKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\+/g, '_plus')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const getLocationCountLabel = (body: LeadBody) => {
  const rawValue = getString(body, LOCATION_COUNT_KEYS);
  if (!rawValue) return null;
  return LOCATION_COUNT_LABELS[normalizeOptionKey(rawValue)] || LOCATION_COUNT_LABELS[rawValue.trim().toLowerCase()] || rawValue;
};

const isCanadaEarlyAccessLead = (body: LeadBody) => {
  const source = getString(body, ['source']).toLowerCase();
  const campaign = getString(body, ['utmCampaign', 'utm_campaign']).toLowerCase();
  const country = getString(body, ['country']).toLowerCase();
  const province = getString(body, ['province', 'provinceTerritory', 'province_territory']);

  return source.includes('canada') || campaign.includes('canada') || country === 'canada' || Boolean(province);
};

const isPodcastLead = (body: LeadBody) => {
  const source = getString(body, ['source']).toLowerCase();
  const campaign = getString(body, ['utmCampaign', 'utm_campaign']).toLowerCase();
  const medium = getString(body, ['utmMedium', 'utm_medium']).toLowerCase();
  const podcastName = getString(body, ['podcastName', 'podcast_name', 'podcast', 'showName', 'show_name']).toLowerCase();
  const partner = getString(body, ['podcastPartner', 'podcast_partner', 'partner', 'partnerName', 'partner_name']).toLowerCase();

  return (
    source.includes('podcast') ||
    campaign.includes('podcast') ||
    medium.includes('podcast') ||
    Boolean(podcastName) ||
    partner.includes('podcast')
  );
};

const getLocationCount = (body: LeadBody) => {
  const rawValue = getString(body, LOCATION_COUNT_KEYS);
  if (!rawValue) return null;

  const count = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(count) || count < 1) return null;
  return Math.min(count, 9999);
};

const getLeadMessage = (body: LeadBody) =>
  getOptionalString(body, MESSAGE_KEYS);

const formatLocationCount = (lead: { location_count?: number | null; location_count_label?: string | null; raw_payload?: Record<string, unknown> | null }) => {
  if (lead.location_count_label) return lead.location_count_label;
  const rawLabel = lead.raw_payload?.locationCountLabel;
  if (typeof rawLabel === 'string' && rawLabel.trim()) return rawLabel.trim();
  return lead.location_count ? String(lead.location_count) : 'Not provided';
};

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return request.headers.get('cf-connecting-ip') || (forwardedFor ? forwardedFor.split(',')[0].trim() : null);
};

const getBearerToken = (request: Request) => {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return request.headers.get('x-wholesale-lead-token')?.trim() || '';
};

const validateToken = (request: Request) => {
  const expectedToken = process.env.WHOLESALE_LEAD_INTAKE_TOKEN;
  if (!expectedToken) {
    throw new Error('WHOLESALE_LEAD_INTAKE_TOKEN is not configured.');
  }

  return getBearerToken(request) === expectedToken;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getPortalUrl = () => {
  return 'https://wholesale.barenakedpet.com/admin/wholesale-pipeline';
};

const formatAddress = (lead: {
  shipping_address_1: string;
  shipping_address_2?: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
}) =>
  [
    lead.shipping_address_1,
    lead.shipping_address_2,
    `${lead.shipping_city}, ${lead.shipping_state} ${lead.shipping_postal_code}`,
  ]
    .filter(Boolean)
    .join('\n');

const sendInboundLeadNotification = async (lead: {
  contact_name: string;
  email: string;
  store_name: string;
  phone?: string | null;
  store_url?: string | null;
  store_type?: string | null;
  location_count?: number | null;
  location_count_label?: string | null;
  message?: string | null;
  shipping_address_1: string;
  shipping_address_2?: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  source?: string | null;
  utm_campaign?: string | null;
}) => {
  const portalUrl = getPortalUrl();
  const address = formatAddress(lead);
  const isCanadaLead = (lead.source || '').toLowerCase().includes('canada') || (lead.utm_campaign || '').toLowerCase().includes('canada');
  const isPodcastSource = (lead.source || '').toLowerCase().includes('podcast') || (lead.utm_campaign || '').toLowerCase().includes('podcast');
  const leadLabel = isCanadaLead ? 'Canadian early-access lead' : isPodcastSource ? 'podcast partner lead' : 'sample request';
  const notifyTo = process.env.WHOLESALE_LEAD_NOTIFY_TO || 'info@barenakedpet.com';
  const from = process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || 'info@barenakedpet.com';

  const text = `
New wholesale ${leadLabel} received.

Store: ${lead.store_name}
Contact: ${lead.contact_name}
Email: ${lead.email}
Phone: ${lead.phone || 'Not provided'}
Store Type: ${lead.store_type || 'Not provided'}
Website/Instagram: ${lead.store_url || 'Not provided'}
Locations: ${formatLocationCount(lead)}
Message: ${lead.message || 'Not provided'}

Shipping address:
${address}

Source: ${lead.source || 'landing_page'}
Campaign: ${lead.utm_campaign || 'Not captured'}

Review in the portal:
${portalUrl}
  `.trim();

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ec;font-family:Arial,Helvetica,sans-serif;color:#3b2a1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f4ec;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eadfce;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px 8px;">
                <p style="margin:0;color:#7a4f2a;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">Bare Naked Pet Co.</p>
                <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#3b2a1e;">New wholesale lead</h1>
                <p style="margin:0 0 20px;color:#6b5f55;font-size:15px;line-height:1.55;">A retailer submitted interest from a landing page. Review the lead in the portal.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <div style="border:1px solid #eadfce;border-radius:12px;padding:18px;background:#fbf7ed;">
                  <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#3b2a1e;">${escapeHtml(lead.store_name)}</p>
                  <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.55;">
                    ${escapeHtml(lead.contact_name)}<br />
                    ${escapeHtml(lead.email)}<br />
                    ${escapeHtml(lead.phone || 'Phone not provided')}
                  </p>
                </div>
                <h2 style="margin:22px 0 8px;font-size:16px;color:#3b2a1e;">Shipping address</h2>
                <p style="margin:0;color:#6b5f55;font-size:15px;line-height:1.6;white-space:pre-line;">${escapeHtml(address)}</p>
                <h2 style="margin:22px 0 8px;font-size:16px;color:#3b2a1e;">Source</h2>
                <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.6;">
                  Source: ${escapeHtml(lead.source || 'landing_page')}<br />
                  Campaign: ${escapeHtml(lead.utm_campaign || 'Not captured')}<br />
                  Store type: ${escapeHtml(lead.store_type || 'Not provided')}<br />
                  Website/Instagram: ${escapeHtml(lead.store_url || 'Not provided')}<br />
                  Locations: ${escapeHtml(formatLocationCount(lead))}<br />
                  Message: ${escapeHtml(lead.message || 'Not provided')}
                </p>
                <p style="margin:24px 0 0;">
                  <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#3b2a1e;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 16px;">Review in portal</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendEmail({
    from,
    to: notifyTo,
    replyTo: lead.email,
    subject: `New wholesale lead: ${lead.store_name}`,
    text,
    html,
    tags: [{ name: 'feature', value: 'wholesale-leads' }],
  });
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Wholesale-Lead-Token',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: Request) {
  try {
    if (!validateToken(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as LeadBody | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Send a valid JSON request body.' }, { status: 400 });
    }

    const contactName = getString(body, ['contactName', 'contact_name', 'name']);
    const email = normalizeEmail(getString(body, ['email']));
    const storeName = getString(body, ['storeName', 'store_name', 'businessName', 'business_name']);
    const isCanadaLead = isCanadaEarlyAccessLead(body);
    const isPodcastSource = isPodcastLead(body);
    const isFlexibleLead = isCanadaLead || isPodcastSource;
    const shippingAddress1 = getString(body, ['shippingAddress1', 'shipping_address_1', 'address1', 'address']);
    const shippingCity = getString(body, ['shippingCity', 'shipping_city', 'city']);
    const shippingState = getString(body, ['shippingState', 'shipping_state', 'state', 'province', 'provinceTerritory', 'province_territory']);
    const shippingPostalCode = getString(body, ['shippingPostalCode', 'shipping_postal_code', 'zip', 'postalCode', 'postal_code']);

    const hasRequiredContactFields = contactName && email && storeName && shippingCity && shippingState;
    const hasSampleShippingFields = shippingAddress1 && shippingPostalCode;

    if (!hasRequiredContactFields || (!isFlexibleLead && !hasSampleShippingFields)) {
      return NextResponse.json(
        {
          error: isFlexibleLead
            ? 'Missing required fields. Include contactName, email, storeName, city, and state or province.'
            : 'Missing required fields. Include contactName, email, storeName, shippingAddress1, shippingCity, shippingState, and shippingPostalCode.',
        },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const locationCount = getLocationCount(body);
    const locationCountLabel = getLocationCountLabel(body);
    const message = getLeadMessage(body);
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent');
    const row = {
      contact_name: contactName,
      email,
      store_name: storeName,
      phone: getOptionalString(body, ['phone']),
      store_url: getOptionalString(body, ['storeUrl', 'store_url', 'website', 'instagram', 'googleBusinessProfile', 'google_business_profile']),
      store_type: getOptionalString(body, ['storeType', 'store_type']),
      location_count: locationCount,
      currently_buying_wholesale: normalizeBuyingWholesale(
        getString(body, ['currentlyBuyingWholesale', 'currently_buying_wholesale', 'buysWholesale', 'buys_wholesale']),
      ),
      lead_status: 'new',
      sample_status: 'not_sent',
      message,
      shipping_address_1: shippingAddress1 || 'Not collected',
      shipping_address_2: getOptionalString(body, ['shippingAddress2', 'shipping_address_2', 'address2']),
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_postal_code: shippingPostalCode || 'Not collected',
      source: getString(body, ['source']) || (isCanadaLead ? 'canada_retailer_early_access' : isPodcastSource ? 'podcast_partner_landing_page' : 'landing_page'),
      utm_source: getOptionalString(body, ['utmSource', 'utm_source']),
      utm_medium: getOptionalString(body, ['utmMedium', 'utm_medium']),
      utm_campaign: getOptionalString(body, ['utmCampaign', 'utm_campaign']),
      utm_content: getOptionalString(body, ['utmContent', 'utm_content']),
      utm_term: getOptionalString(body, ['utmTerm', 'utm_term']),
      gclid: getOptionalString(body, ['gclid']),
      fbclid: getOptionalString(body, ['fbclid']),
      fbp: getOptionalString(body, ['fbp', '_fbp']),
      fbc: getOptionalString(body, ['fbc', '_fbc']),
      landing_page_url: getOptionalString(body, ['landingPageUrl', 'landing_page_url']),
      referrer: getOptionalString(body, ['referrer']),
      user_agent: userAgent,
      ip_address: clientIp,
      raw_payload: {
        ...body,
        locationCountLabel,
      },
      last_submitted_at: now,
      updated_at: now,
    };

    const adminClient = createSupabaseAdminClient();
    const { data: existingLead, error: existingError } = await adminClient
      .from('wholesale_leads')
      .select('id, submission_count, ip_address, user_agent, created_at')
      .eq('email', email)
      .maybeSingle();

    if (existingError) {
      console.error('Wholesale lead lookup error:', existingError);
      return NextResponse.json({ error: 'Unable to save sample request.' }, { status: 500 });
    }

    const { lead_status: _leadStatus, sample_status: _sampleStatus, ip_address: _ipAddress, user_agent: _userAgent, ...mutableRow } = row;
    const { data, error } = existingLead?.id
      ? await adminClient
          .from('wholesale_leads')
          .update({
            ...mutableRow,
            ip_address: existingLead.ip_address,
            user_agent: existingLead.user_agent,
            submission_count: (existingLead.submission_count || 1) + 1,
          })
          .eq('id', existingLead.id)
          .select('id, email, store_name, status, lead_status, sample_status, created_at')
          .single()
      : await adminClient
          .from('wholesale_leads')
          .insert(row)
          .select('id, email, store_name, status, lead_status, sample_status, created_at')
          .single();

    if (error) {
      console.error('Wholesale lead insert error:', error);
      return NextResponse.json({ error: 'Unable to save sample request.' }, { status: 500 });
    }

    await sendInboundLeadNotification(row).catch((emailError) => {
      console.error('Wholesale lead notification email error:', emailError);
    });

    return NextResponse.json({
      success: true,
      lead: data,
      message: isCanadaLead
        ? 'Canadian retailer early-access request received.'
        : isPodcastSource
          ? 'Podcast partner lead received.'
          : 'Sample request received.',
    });
  } catch (error) {
    console.error('Wholesale lead intake error:', error);
    if (error instanceof Error && error.message.includes('WHOLESALE_LEAD_INTAKE_TOKEN')) {
      return NextResponse.json({ error: 'Lead intake is not configured.' }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Unable to receive sample request.' },
      { status: 500 },
    );
  }
}
