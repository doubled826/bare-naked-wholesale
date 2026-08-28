import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  findGoogleBusinessMatch,
  GooglePlacesConfigurationError,
  GooglePlacesLookupError,
} from '@/lib/googlePlaces';

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = 'force-dynamic';

const toErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : 'Unable to compare with Google Business listing.'
);

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const locationId = params.id;
    if (!locationId) {
      return NextResponse.json({ error: 'Missing location id.' }, { status: 400 });
    }

    const { adminClient } = await requireAdminAccess();
    const { data: location, error: locationError } = await adminClient
      .from('retailer_locations')
      .select(`
        id,
        location_name,
        public_display_name,
        business_address,
        retailer:retailers(company_name)
      `)
      .eq('id', locationId)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found.' }, { status: 404 });
    }

    const retailer = Array.isArray(location.retailer) ? location.retailer[0] : location.retailer;
    const name = location.public_display_name || location.location_name || retailer?.company_name || '';

    const match = await findGoogleBusinessMatch({
      name,
      address: location.business_address || '',
    });

    await adminClient
      .from('retailer_locations')
      .update({
        google_place_id: match.placeId,
        google_place_match_confidence: match.confidence,
        google_place_matched_at: new Date().toISOString(),
        google_place_match_error: null,
      })
      .eq('id', location.id);

    return NextResponse.json({
      success: true,
      match,
    });
  } catch (error) {
    const status = error instanceof AdminAuthorizationError
      ? error.status
      : error instanceof GooglePlacesConfigurationError
        ? 503
        : error instanceof GooglePlacesLookupError
          ? 404
          : 500;
    const message = toErrorMessage(error);

    if (params.id && !(error instanceof AdminAuthorizationError)) {
      try {
        const { adminClient } = await requireAdminAccess();
        await adminClient
          .from('retailer_locations')
          .update({
            google_place_match_error: message,
            google_place_matched_at: new Date().toISOString(),
          })
          .eq('id', params.id);
      } catch (updateError) {
        console.warn('Unable to record Google Place match error:', updateError);
      }
    }

    console.error('Google Place comparison error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
