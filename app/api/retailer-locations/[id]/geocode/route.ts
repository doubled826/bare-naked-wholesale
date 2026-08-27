import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { geocodeAddress, GeocodingConfigurationError } from '@/lib/geocoding';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = 'force-dynamic';

const toErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : 'Unable to geocode location.'
);

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const locationId = params.id;
    if (!locationId) {
      return NextResponse.json({ error: 'Missing location id.' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data: location, error: locationError } = await adminClient
      .from('retailer_locations')
      .select('id, retailer_id, business_address')
      .eq('id', locationId)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
    }

    let isAuthorized = location.retailer_id === user.id;

    if (!isAuthorized) {
      const { data: adminUser } = await adminClient
        .from('admin_users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      isAuthorized = Boolean(adminUser);
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const geocoded = await geocodeAddress(location.business_address || '');
    const { data: updatedLocation, error: updateError } = await adminClient
      .from('retailer_locations')
      .update({
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        geocoded_at: new Date().toISOString(),
        geocoding_error: null,
        locator_updated_at: new Date().toISOString(),
      })
      .eq('id', location.id)
      .select('id, latitude, longitude, geocoded_at')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      location: updatedLocation,
      formattedAddress: geocoded.formattedAddress || null,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    const status = error instanceof GeocodingConfigurationError ? 503 : 500;
    console.error('Location geocode error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
