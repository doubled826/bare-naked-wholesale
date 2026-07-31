ALTER TABLE retailers
  ADD COLUMN IF NOT EXISTS how_heard_about_us TEXT,
  ADD COLUMN IF NOT EXISTS how_heard_about_us_other TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_retailer()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.retailers (
    id,
    company_name,
    business_address,
    phone,
    contact_name,
    how_heard_about_us,
    how_heard_about_us_other,
    status
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'company_name', 'New Retailer'),
    COALESCE(new.raw_user_meta_data->>'business_address', 'No Address Provided'),
    COALESCE(new.raw_user_meta_data->>'phone', 'No Phone Provided'),
    NULLIF(TRIM(new.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'how_heard_about_us'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'how_heard_about_us_other'), ''),
    'pending'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
