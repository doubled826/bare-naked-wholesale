ALTER TABLE retailer_success_profiles
  DROP CONSTRAINT IF EXISTS retailer_success_profiles_marketing_materials_status_check;

ALTER TABLE retailer_success_profiles
  ADD CONSTRAINT retailer_success_profiles_marketing_materials_status_check
  CHECK (marketing_materials_status IN ('not_requested', 'have_materials', 'requested', 'sent'));
