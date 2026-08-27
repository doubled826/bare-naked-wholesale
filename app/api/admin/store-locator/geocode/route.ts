import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import { geocodeAddress, GeocodingConfigurationError, isGeocodingConfigured } from '@/lib/geocoding';

export const dynamic = 'force-dynamic';

type GeocodeCandidate = {
  id: string;
  business_address: string;
};

const getLimit = (request: Request) => {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit') || 25);
  if (!Number.isFinite(rawLimit)) return 25;
  return Math.max(1, Math.min(Math.floor(rawLimit), 100));
};

export async function POST(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();

    if (!isGeocodingConfigured()) {
      return NextResponse.json({ error: 'Missing geocoding API key.' }, { status: 503 });
    }

    const limit = getLimit(request);
    const { data, error } = await adminClient
      .from('retailer_locations')
      .select('id, business_address')
      .eq('is_public', true)
      .is('latitude', null)
      .not('business_address', 'is', null)
      .limit(limit);

    if (error) throw error;

    const candidates = (data || []) as GeocodeCandidate[];
    const results = [];

    for (const location of candidates) {
      try {
        const geocoded = await geocodeAddress(location.business_address || '');
        const { error: updateError } = await adminClient
          .from('retailer_locations')
          .update({
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            geocoded_at: new Date().toISOString(),
            geocoding_error: null,
            locator_updated_at: new Date().toISOString(),
          })
          .eq('id', location.id);

        if (updateError) throw updateError;

        results.push({ id: location.id, success: true });
      } catch (geocodeError) {
        const message = geocodeError instanceof Error ? geocodeError.message : 'Unable to geocode location.';
        await adminClient
          .from('retailer_locations')
          .update({
            geocoding_error: message,
            geocoded_at: new Date().toISOString(),
          })
          .eq('id', location.id);

        results.push({ id: location.id, success: false, error: message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      geocoded: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof GeocodingConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error('Bulk store locator geocode error:', error);
    return NextResponse.json({ error: 'Unable to geocode store locator locations.' }, { status: 500 });
  }
}
