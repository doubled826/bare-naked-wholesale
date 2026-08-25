ALTER TABLE retailers
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE email_campaign_recipients
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

UPDATE retailers
SET contact_name = NULLIF(TRIM(auth.users.raw_user_meta_data->>'display_name'), '')
FROM auth.users
WHERE retailers.id = auth.users.id
  AND (retailers.contact_name IS NULL OR TRIM(retailers.contact_name) = '')
  AND NULLIF(TRIM(auth.users.raw_user_meta_data->>'display_name'), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_retailer()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.retailers (id, company_name, business_address, phone, contact_name, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'company_name', 'New Retailer'),
    COALESCE(new.raw_user_meta_data->>'business_address', 'No Address Provided'),
    COALESCE(new.raw_user_meta_data->>'phone', 'No Phone Provided'),
    NULLIF(TRIM(new.raw_user_meta_data->>'display_name'), ''),
    'pending'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
