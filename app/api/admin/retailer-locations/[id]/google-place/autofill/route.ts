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

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const googleMapsUrl = typeof body.googleMapsUrl === 'string' ? body.googleMapsUrl.trim() : '';

    if (!googleMapsUrl) {
      return NextResponse.json({ success: false, error: 'Google Maps listing URL is required.' }, { status: 400 });
    }

    const { data: location, error: locationError } = await adminClient
      .from('retailer_locations')
      .select(`
        id,
        location_name,
        public_display_name,
        business_address,
        retailer:retailers(company_name)
      `)
      .eq('id', params.id)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ success: false, error: 'Location not found.' }, { status: 404 });
    }

    const retailer = Array.isArray(location.retailer) ? location.retailer[0] : location.retailer;
    const match = await findGoogleBusinessMatch({
      googleMapsUrl,
      name: location.public_display_name || location.location_name || retailer?.company_name || '',
      address: location.business_address || '',
    });

    return NextResponse.json({
      success: true,
      autofill: {
        google_place_id: match.placeId,
        google_place_url: match.resolvedUrl || googleMapsUrl,
        public_display_name: match.displayName,
        public_address: match.formattedAddress,
        public_phone: match.nationalPhoneNumber || match.internationalPhoneNumber,
        website_url: match.websiteUri,
        latitude: match.latitude,
        longitude: match.longitude,
        google_maps_url: match.googleMapsUri,
        business_status: match.businessStatus,
        confidence: match.confidence,
      },
    });
  } catch (error) {
    const status = error instanceof AdminAuthorizationError
      ? error.status
      : error instanceof GooglePlacesConfigurationError
        ? 503
        : error instanceof GooglePlacesLookupError
          ? 400
          : 500;
    const message = error instanceof Error ? error.message : 'Unable to autofill from Google.';

    console.error('Google Place autofill error:', error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
