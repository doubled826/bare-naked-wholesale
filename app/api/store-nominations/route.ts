import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type NominationBody = Record<string, unknown>;

const MAX_TEXT_LENGTH = 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Store-Nomination-Token',
};

const getString = (body: NominationBody, keys: string[], maxLength = MAX_TEXT_LENGTH) => {
  for (const key of keys) {
    const value = body[key];

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed.slice(0, maxLength);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value).slice(0, maxLength);
    }
  }

  return '';
};

const getOptionalString = (body: NominationBody, keys: string[], maxLength = MAX_TEXT_LENGTH) => {
  const value = getString(body, keys, maxLength);
  return value || null;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return request.headers.get('cf-connecting-ip') || (forwardedFor ? forwardedFor.split(',')[0].trim() : null);
};

const getBearerToken = (request: Request) => {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return request.headers.get('x-store-nomination-token')?.trim() || '';
};

const validateTokenIfConfigured = (request: Request) => {
  const expectedToken = process.env.STORE_NOMINATION_INTAKE_TOKEN;
  if (!expectedToken) return true;

  return getBearerToken(request) === expectedToken;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getPortalUrl = () => 'https://wholesale.barenakedpet.com/admin/store-nominations';

const formatStoreAddress = (nomination: {
  store_address?: string | null;
  store_city?: string | null;
  store_state?: string | null;
  store_postal_code?: string | null;
}) =>
  [
    nomination.store_address,
    [nomination.store_city, nomination.store_state, nomination.store_postal_code].filter(Boolean).join(', ').replace(', ', ', '),
  ]
    .filter(Boolean)
    .join('\n');

const sendStoreNominationNotification = async (nomination: {
  consumer_name: string;
  consumer_email: string;
  consumer_phone?: string | null;
  store_name: string;
  store_address?: string | null;
  store_city?: string | null;
  store_state?: string | null;
  store_postal_code?: string | null;
  store_url?: string | null;
  note?: string | null;
  source?: string | null;
  utm_campaign?: string | null;
}) => {
  const portalUrl = getPortalUrl();
  const notifyTo = process.env.STORE_NOMINATION_NOTIFY_TO || process.env.WHOLESALE_LEAD_NOTIFY_TO || 'info@barenakedpet.com';
  const from = process.env.PORTAL_EMAIL_FROM || process.env.ORDER_EMAIL_FROM || process.env.SMTP_USER || 'info@barenakedpet.com';
  const address = formatStoreAddress(nomination) || 'Not provided';

  const text = `
New store nomination received.

Store: ${nomination.store_name}
Address:
${address}
Website/Social: ${nomination.store_url || 'Not provided'}

Submitted by:
${nomination.consumer_name}
${nomination.consumer_email}
${nomination.consumer_phone || 'Phone not provided'}

Note:
${nomination.note || 'Not provided'}

Source: ${nomination.source || 'store_locator'}
Campaign: ${nomination.utm_campaign || 'Not captured'}

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
                <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#3b2a1e;">New store nomination</h1>
                <p style="margin:0 0 20px;color:#6b5f55;font-size:15px;line-height:1.55;">A customer recommended a neighborhood store for Bare.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <div style="border:1px solid #eadfce;border-radius:12px;padding:18px;background:#fbf7ed;">
                  <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#3b2a1e;">${escapeHtml(nomination.store_name)}</p>
                  <p style="margin:0;color:#6b5f55;font-size:14px;line-height:1.55;white-space:pre-line;">${escapeHtml(address)}</p>
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td style="padding:0 0 10px;color:#3b2a1e;font-size:15px;"><strong>Submitted by:</strong> ${escapeHtml(nomination.consumer_name)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px;color:#6b5f55;font-size:14px;">${escapeHtml(nomination.consumer_email)}${nomination.consumer_phone ? ` · ${escapeHtml(nomination.consumer_phone)}` : ''}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px;color:#6b5f55;font-size:14px;"><strong>Website/Social:</strong> ${escapeHtml(nomination.store_url || 'Not provided')}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 18px;color:#6b5f55;font-size:14px;line-height:1.55;"><strong>Note:</strong> ${escapeHtml(nomination.note || 'Not provided')}</td>
                  </tr>
                </table>
                <a href="${portalUrl}" style="display:inline-block;background:#3b2a1e;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 16px;font-weight:700;font-size:14px;">Review nomination</a>
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
    replyTo: nomination.consumer_email,
    subject: `New store nomination: ${nomination.store_name}`,
    text,
    html,
    tags: [{ name: 'feature', value: 'store-nominations' }],
  });
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  try {
    if (!validateTokenIfConfigured(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Submit the nomination as a JSON object.' },
        { status: 400, headers: corsHeaders },
      );
    }

    const nominationBody = body as NominationBody;
    const consumerName = getString(nominationBody, ['consumerName', 'consumer_name', 'name', 'yourName', 'your_name'], 160);
    const consumerEmail = normalizeEmail(getString(nominationBody, ['consumerEmail', 'consumer_email', 'email', 'emailAddress', 'email_address'], 254));
    const storeName = getString(nominationBody, ['storeName', 'store_name', 'businessName', 'business_name', 'retailerName', 'retailer_name'], 220);
    const storeCity = getString(nominationBody, ['storeCity', 'store_city', 'city'], 120);
    const storeState = getString(nominationBody, ['storeState', 'store_state', 'state', 'province'], 80);

    if (!consumerName) {
      return NextResponse.json({ success: false, error: 'Consumer name is required.' }, { status: 400, headers: corsHeaders });
    }

    if (!consumerEmail || !isValidEmail(consumerEmail)) {
      return NextResponse.json({ success: false, error: 'A valid consumer email is required.' }, { status: 400, headers: corsHeaders });
    }

    if (!storeName) {
      return NextResponse.json({ success: false, error: 'Store name is required.' }, { status: 400, headers: corsHeaders });
    }

    if (!storeCity || !storeState) {
      return NextResponse.json({ success: false, error: 'Store city and state are required.' }, { status: 400, headers: corsHeaders });
    }

    const nomination = {
      consumer_name: consumerName,
      consumer_email: consumerEmail,
      consumer_phone: getOptionalString(nominationBody, ['consumerPhone', 'consumer_phone', 'phone', 'phoneNumber', 'phone_number'], 80),
      store_name: storeName,
      store_address: getOptionalString(nominationBody, ['storeAddress', 'store_address', 'address', 'address1', 'streetAddress', 'street_address'], 240),
      store_city: storeCity,
      store_state: storeState,
      store_postal_code: getOptionalString(nominationBody, ['storePostalCode', 'store_postal_code', 'postalCode', 'postal_code', 'zip', 'zipcode', 'zipCode'], 40),
      store_url: getOptionalString(nominationBody, ['storeUrl', 'store_url', 'website', 'websiteUrl', 'website_url', 'socialLink', 'social_link', 'instagram'], 300),
      note: getOptionalString(nominationBody, ['note', 'notes', 'message', 'comment', 'comments'], 2000),
      source: getOptionalString(nominationBody, ['source'], 120) || 'store_locator',
      landing_page_url: getOptionalString(nominationBody, ['landingPageUrl', 'landing_page_url', 'pageUrl', 'page_url'], 500),
      referrer: getOptionalString(nominationBody, ['referrer', 'referer'], 500) || request.headers.get('referer'),
      utm_source: getOptionalString(nominationBody, ['utmSource', 'utm_source'], 120),
      utm_medium: getOptionalString(nominationBody, ['utmMedium', 'utm_medium'], 120),
      utm_campaign: getOptionalString(nominationBody, ['utmCampaign', 'utm_campaign'], 160),
      utm_content: getOptionalString(nominationBody, ['utmContent', 'utm_content'], 160),
      utm_term: getOptionalString(nominationBody, ['utmTerm', 'utm_term'], 160),
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent'),
      raw_payload: nominationBody,
    };

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from('store_nominations')
      .insert(nomination)
      .select('id, status')
      .single();

    if (error) {
      console.error('Store nomination insert error:', error);
      return NextResponse.json(
        { success: false, error: 'Unable to save store nomination.' },
        { status: 500, headers: corsHeaders },
      );
    }

    try {
      await sendStoreNominationNotification(nomination);
    } catch (emailError) {
      console.error('Store nomination notification error:', emailError);
    }

    return NextResponse.json(
      {
        success: true,
        nomination: data,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Store nomination intake error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to submit store nomination.' },
      { status: 500, headers: corsHeaders },
    );
  }
}
