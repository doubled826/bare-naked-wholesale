ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS application_method TEXT NOT NULL DEFAULT 'promo_code'
    CHECK (application_method IN ('automatic', 'promo_code'));

UPDATE discount_codes
SET application_method = 'promo_code'
WHERE application_method IS NULL;
