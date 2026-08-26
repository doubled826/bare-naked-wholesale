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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from('retailer_locations')
      .select(`
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
      `)
      .eq('is_public', true)
      .order('location_name', { ascending: true });

    if (error) throw error;

    const locations = ((data || []) as StoreLocatorLocationRow[])
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
