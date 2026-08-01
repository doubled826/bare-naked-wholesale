import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type LeadBody = Record<string, unknown>;

const BUYING_WHOLESALE_VALUES = new Set(['yes', 'no', 'opening_soon']);
const MAX_TEXT_LENGTH = 500;

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

const getLocationCount = (body: LeadBody) => {
  const rawValue = getString(body, ['locationCount', 'location_count', 'numberOfLocations', 'number_of_locations']);
  if (!rawValue) return null;

  const count = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(count) || count < 1) return null;
  return Math.min(count, 9999);
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
    const shippingAddress1 = getString(body, ['shippingAddress1', 'shipping_address_1', 'address1', 'address']);
    const shippingCity = getString(body, ['shippingCity', 'shipping_city', 'city']);
    const shippingState = getString(body, ['shippingState', 'shipping_state', 'state']);
    const shippingPostalCode = getString(body, ['shippingPostalCode', 'shipping_postal_code', 'zip', 'postalCode', 'postal_code']);

    if (!contactName || !email || !storeName || !shippingAddress1 || !shippingCity || !shippingState || !shippingPostalCode) {
      return NextResponse.json(
        {
          error:
            'Missing required fields. Include contactName, email, storeName, shippingAddress1, shippingCity, shippingState, and shippingPostalCode.',
        },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const row = {
      contact_name: contactName,
      email,
      store_name: storeName,
      phone: getOptionalString(body, ['phone']),
      store_url: getOptionalString(body, ['storeUrl', 'store_url', 'website', 'instagram']),
      store_type: getOptionalString(body, ['storeType', 'store_type']),
      location_count: getLocationCount(body),
      currently_buying_wholesale: normalizeBuyingWholesale(
        getString(body, ['currentlyBuyingWholesale', 'currently_buying_wholesale', 'buysWholesale', 'buys_wholesale']),
      ),
      shipping_address_1: shippingAddress1,
      shipping_address_2: getOptionalString(body, ['shippingAddress2', 'shipping_address_2', 'address2']),
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_postal_code: shippingPostalCode,
      source: getString(body, ['source']) || 'landing_page',
      utm_source: getOptionalString(body, ['utmSource', 'utm_source']),
      utm_medium: getOptionalString(body, ['utmMedium', 'utm_medium']),
      utm_campaign: getOptionalString(body, ['utmCampaign', 'utm_campaign']),
      utm_content: getOptionalString(body, ['utmContent', 'utm_content']),
      utm_term: getOptionalString(body, ['utmTerm', 'utm_term']),
      gclid: getOptionalString(body, ['gclid']),
      fbclid: getOptionalString(body, ['fbclid']),
      landing_page_url: getOptionalString(body, ['landingPageUrl', 'landing_page_url']),
      referrer: getOptionalString(body, ['referrer']),
      user_agent: request.headers.get('user-agent'),
      ip_address: getClientIp(request),
      raw_payload: body,
      last_submitted_at: now,
      updated_at: now,
    };

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from('wholesale_leads')
      .upsert(row, {
        onConflict: 'email',
      })
      .select('id, email, store_name, status, created_at')
      .single();

    if (error) {
      console.error('Wholesale lead insert error:', error);
      return NextResponse.json({ error: 'Unable to save sample request.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lead: data,
      message: 'Sample request received.',
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
