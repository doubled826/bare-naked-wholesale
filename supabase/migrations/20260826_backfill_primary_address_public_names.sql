UPDATE retailer_locations AS location
SET
  public_display_name = retailer.company_name,
  locator_updated_at = NOW()
FROM retailers AS retailer
WHERE location.retailer_id = retailer.id
  AND LOWER(TRIM(location.location_name)) = 'primary address'
  AND COALESCE(TRIM(location.public_display_name), '') = ''
  AND COALESCE(TRIM(retailer.company_name), '') <> '';
