ALTER TABLE retailer_locations
  ADD COLUMN IF NOT EXISTS google_place_review_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (google_place_review_status IN (
      'needs_review',
      'high_confidence',
      'low_confidence',
      'no_listing',
      'approved_portal_data',
      'use_google_manually',
      'dismissed'
    )),
  ADD COLUMN IF NOT EXISTS google_place_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_place_review_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_retailer_locations_google_place_review_status
  ON retailer_locations(google_place_review_status, google_place_matched_at DESC);
