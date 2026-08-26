ALTER TABLE retailer_locations
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_display_name TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS public_hours TEXT,
  ADD COLUMN IF NOT EXISTS public_notes TEXT,
  ADD COLUMN IF NOT EXISTS locator_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locator_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_retailer_locations_store_locator_public
  ON retailer_locations(is_public, created_at)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_retailer_locations_coordinates
  ON retailer_locations(latitude, longitude)
  WHERE is_public = true AND latitude IS NOT NULL AND longitude IS NOT NULL;
