INSERT INTO retailer_locations (
  retailer_id,
  location_name,
  public_display_name,
  business_address,
  phone,
  is_default,
  is_public,
  locator_updated_at,
  locator_verified_at
)
SELECT
  retailer.id,
  'Primary Address',
  retailer.company_name,
  retailer.business_address,
  NULLIF(NULLIF(retailer.phone, 'No Phone Provided'), ''),
  true,
  true,
  NOW(),
  NOW()
FROM retailers AS retailer
WHERE COALESCE(TRIM(retailer.business_address), '') <> ''
  AND retailer.business_address <> 'No Address Provided'
  AND NOT EXISTS (
    SELECT 1
    FROM retailer_locations AS location
    WHERE location.retailer_id = retailer.id
  );

CREATE OR REPLACE FUNCTION public.handle_new_retailer()
RETURNS trigger AS $$
DECLARE
  retailer_company_name TEXT;
  retailer_business_address TEXT;
  retailer_phone TEXT;
BEGIN
  retailer_company_name := COALESCE(new.raw_user_meta_data->>'company_name', 'New Retailer');
  retailer_business_address := COALESCE(new.raw_user_meta_data->>'business_address', 'No Address Provided');
  retailer_phone := COALESCE(new.raw_user_meta_data->>'phone', 'No Phone Provided');

  INSERT INTO public.retailers (id, company_name, business_address, phone, contact_name, how_heard_about_us, how_heard_about_us_other, status)
  VALUES (
    new.id,
    retailer_company_name,
    retailer_business_address,
    retailer_phone,
    NULLIF(TRIM(new.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'how_heard_about_us'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'how_heard_about_us_other'), ''),
    'pending'
  );

  IF COALESCE(TRIM(retailer_business_address), '') <> '' AND retailer_business_address <> 'No Address Provided' THEN
    INSERT INTO public.retailer_locations (
      retailer_id,
      location_name,
      public_display_name,
      business_address,
      phone,
      is_default,
      is_public,
      locator_updated_at,
      locator_verified_at
    )
    VALUES (
      new.id,
      'Primary Address',
      retailer_company_name,
      retailer_business_address,
      NULLIF(NULLIF(retailer_phone, 'No Phone Provided'), ''),
      true,
      true,
      NOW(),
      NOW()
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
