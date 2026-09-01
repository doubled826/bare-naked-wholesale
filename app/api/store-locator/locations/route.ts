import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { toPublicStoreLocatorLocation, type StoreLocatorLocationRow } from '@/lib/storeLocator';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
};

const LOCATION_SELECT = `
  id,
  retailer_id,
  location_name,
  business_address,
  phone,
  public_display_name,
  public_address,
  public_phone,
  website_url,
  instagram_url,
  latitude,
  longitude,
  public_hours,
  public_notes,
  locator_updated_at,
  locator_verified_at,
  created_at,
  retailer:retailers(company_name, logo_url)
`;

const LOCATION_SELECT_BASE = `
  id,
  retailer_id,
  location_name,
  business_address,
  phone,
  public_display_name,
  website_url,
  instagram_url,
  latitude,
  longitude,
  public_hours,
  public_notes,
  locator_updated_at,
  locator_verified_at,
  created_at,
  retailer:retailers(company_name, logo_url)
`;

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === '42703';
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from('retailer_locations')
      .select(LOCATION_SELECT)
      .eq('is_public', true)
      .order('location_name', { ascending: true });

    let rows: any[] = data || [];
    if (error) {
      if (!isMissingColumnError(error)) throw error;

      const fallbackResult = await adminClient
        .from('retailer_locations')
        .select(LOCATION_SELECT_BASE)
        .eq('is_public', true)
        .order('location_name', { ascending: true });

      if (fallbackResult.error) throw fallbackResult.error;
      rows = fallbackResult.data || [];
    }

    const locations = (rows as StoreLocatorLocationRow[])
      .map(toPublicStoreLocatorLocation)
      .filter((location) => Boolean(location.address));

    return NextResponse.json({
      locations,
      meta: {
        count: locations.length,
        generated_at: new Date().toISOString(),
      },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Store locator locations API error:', error);
    return NextResponse.json(
      { error: 'Unable to load store locator locations.' },
      { status: 500, headers: corsHeaders },
    );
  }
}
