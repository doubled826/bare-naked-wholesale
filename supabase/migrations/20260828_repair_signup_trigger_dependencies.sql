ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS how_heard_about_us TEXT,
  ADD COLUMN IF NOT EXISTS how_heard_about_us_other TEXT;

ALTER TABLE public.retailer_locations
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_display_name TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS public_hours TEXT,
  ADD COLUMN IF NOT EXISTS public_notes TEXT,
  ADD COLUMN IF NOT EXISTS locator_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locator_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocoding_error TEXT;

UPDATE public.retailer_locations
SET is_public = true
WHERE is_public IS NULL;

ALTER TABLE public.retailer_locations
  ALTER COLUMN is_public SET DEFAULT true,
  ALTER COLUMN is_public SET NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.retailer_account_seq START 1000;

ALTER TABLE public.retailers
  ALTER COLUMN account_number SET DEFAULT ('BNP-' || nextval('public.retailer_account_seq')::text);

CREATE OR REPLACE FUNCTION public.handle_new_retailer()
RETURNS trigger AS $$
DECLARE
  retailer_company_name TEXT;
  retailer_business_address TEXT;
  retailer_phone TEXT;
BEGIN
  retailer_company_name := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'company_name'), ''), 'New Retailer');
  retailer_business_address := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'business_address'), ''), 'No Address Provided');
  retailer_phone := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'phone'), ''), 'No Phone Provided');

  INSERT INTO public.retailers (
    id,
    company_name,
    business_address,
    phone,
    contact_name,
    tax_id,
    how_heard_about_us,
    how_heard_about_us_other,
    status
  )
  VALUES (
    new.id,
    retailer_company_name,
    retailer_business_address,
    retailer_phone,
    NULLIF(TRIM(new.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'tax_id'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'how_heard_about_us'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'how_heard_about_us_other'), ''),
    'pending'
  );

  IF retailer_business_address <> 'No Address Provided' THEN
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
      NULLIF(retailer_phone, 'No Phone Provided'),
      true,
      true,
      NOW(),
      NOW()
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_retailer();
