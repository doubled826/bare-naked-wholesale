ALTER TABLE retailer_locations
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_place_match_confidence NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS google_place_matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_place_match_error TEXT;

CREATE INDEX IF NOT EXISTS idx_retailer_locations_google_place_id
  ON retailer_locations(google_place_id)
  WHERE google_place_id IS NOT NULL;
