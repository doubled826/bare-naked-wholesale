import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';
import {
  findGoogleBusinessMatch,
  GooglePlacesConfigurationError,
  GooglePlacesLookupError,
  isGooglePlacesConfigured,
} from '@/lib/googlePlaces';

export const dynamic = 'force-dynamic';

type GoogleReviewCandidate = {
  id: string;
  location_name: string;
  public_display_name?: string | null;
  business_address: string;
  google_place_matched_at?: string | null;
  google_place_review_status?: string | null;
  retailer?: { company_name?: string | null } | Array<{ company_name?: string | null }> | null;
};

const getLimit = (request: Request) => {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit') || 25);
  if (!Number.isFinite(rawLimit)) return 25;
  return Math.max(1, Math.min(Math.floor(rawLimit), 100));
};

const getStatus = (request: Request) => {
  const url = new URL(request.url);
  return url.searchParams.get('status') || 'needs_review';
};

const getRetailerName = (location: GoogleReviewCandidate) => {
  const retailer = Array.isArray(location.retailer) ? location.retailer[0] : location.retailer;
  return retailer?.company_name || '';
};

const getMatchName = (location: GoogleReviewCandidate) =>
  location.public_display_name || location.location_name || getRetailerName(location);

const toReviewStatus = (confidence: number) => confidence >= 0.75 ? 'high_confidence' : 'low_confidence';

export async function GET(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'needs_review';
    const includeAll = status === 'all';

    let query = adminClient
      .from('retailer_locations')
      .select(`
        id,
        retailer_id,
        location_name,
        public_display_name,
        business_address,
        phone,
        is_public,
        google_place_id,
        google_place_match_confidence,
        google_place_matched_at,
        google_place_match_error,
        google_place_review_status,
        google_place_reviewed_at,
        google_place_review_notes,
        retailer:retailers(id, company_name)
      `)
      .eq('is_public', true)
      .order('google_place_matched_at', { ascending: true, nullsFirst: true })
      .limit(250);

    if (!includeAll) {
      query = query.eq('google_place_review_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, locations: data || [] });
  } catch (error) {
    const status = error instanceof AdminAuthorizationError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unable to load Google review queue.';
    console.error('Google review queue load error:', error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { adminClient } = await requireAdminAccess();

    if (!isGooglePlacesConfigured()) {
      return NextResponse.json({ success: false, error: 'Missing Google Places API key.' }, { status: 503 });
    }

    const limit = getLimit(request);
    const status = getStatus(request);
    const { data, error } = await adminClient
      .from('retailer_locations')
      .select(`
        id,
        location_name,
        public_display_name,
        business_address,
        google_place_matched_at,
        google_place_review_status,
        retailer:retailers(company_name)
      `)
      .eq('is_public', true)
      .eq('google_place_review_status', status)
      .not('business_address', 'is', null)
      .order('google_place_matched_at', { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) throw error;

    const candidates = (data || []) as GoogleReviewCandidate[];
    const results = [];

    for (const location of candidates) {
      try {
        const match = await findGoogleBusinessMatch({
          name: getMatchName(location),
          address: location.business_address || '',
        });
        const reviewStatus = toReviewStatus(match.confidence);

        await adminClient
          .from('retailer_locations')
          .update({
            google_place_id: match.placeId,
            google_place_match_confidence: match.confidence,
            google_place_matched_at: new Date().toISOString(),
            google_place_match_error: null,
            google_place_review_status: reviewStatus,
          })
          .eq('id', location.id);

        results.push({
          id: location.id,
          success: true,
          status: reviewStatus,
          confidence: match.confidence,
          name: match.displayName,
        });
      } catch (matchError) {
        const message = matchError instanceof Error ? matchError.message : 'Unable to compare with Google.';
        await adminClient
          .from('retailer_locations')
          .update({
            google_place_match_error: message,
            google_place_matched_at: new Date().toISOString(),
            google_place_review_status: 'no_listing',
          })
          .eq('id', location.id);

        results.push({
          id: location.id,
          success: false,
          status: 'no_listing',
          error: message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      highConfidence: results.filter((result) => result.status === 'high_confidence').length,
      lowConfidence: results.filter((result) => result.status === 'low_confidence').length,
      noListing: results.filter((result) => result.status === 'no_listing').length,
      results,
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    if (error instanceof GooglePlacesConfigurationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 503 });
    }

    if (error instanceof GooglePlacesLookupError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }

    console.error('Bulk Google review queue error:', error);
    return NextResponse.json({ success: false, error: 'Unable to run Google review queue.' }, { status: 500 });
  }
}
