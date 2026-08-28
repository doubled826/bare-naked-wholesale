import { NextResponse } from 'next/server';
import { AdminAuthorizationError, requireAdminAccess } from '@/lib/admin';

type RouteContext = {
  params: {
    id: string;
  };
};

const allowedStatuses = new Set([
  'needs_review',
  'high_confidence',
  'low_confidence',
  'no_listing',
  'approved_portal_data',
  'use_google_manually',
  'dismissed',
]);

const getOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 5000) : null;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { adminClient } = await requireAdminAccess();
    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === 'string' ? body.status : '';

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ success: false, error: 'Invalid Google review status.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('retailer_locations')
      .update({
        google_place_review_status: status,
        google_place_review_notes: getOptionalString(body.notes ?? body.google_place_review_notes),
        google_place_reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)
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
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, location: data });
  } catch (error) {
    const status = error instanceof AdminAuthorizationError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unable to update Google review status.';
    console.error('Google review status update error:', error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
