ALTER TABLE retailer_locations
  ADD COLUMN IF NOT EXISTS public_address TEXT,
  ADD COLUMN IF NOT EXISTS public_phone TEXT,
  ADD COLUMN IF NOT EXISTS google_place_url TEXT,
  ADD COLUMN IF NOT EXISTS google_place_autofilled_at TIMESTAMPTZ;
