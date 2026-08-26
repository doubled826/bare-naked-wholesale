ALTER TABLE retailer_locations
  ALTER COLUMN is_public SET DEFAULT true;

UPDATE retailer_locations
SET
  is_public = true,
  locator_updated_at = COALESCE(locator_updated_at, NOW()),
  locator_verified_at = COALESCE(locator_verified_at, NOW())
WHERE is_public = false;
