ALTER TABLE retailer_success_profiles
  ADD COLUMN IF NOT EXISTS private_promo_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS private_promo_source TEXT,
  ADD COLUMN IF NOT EXISTS private_promo_start_date DATE,
  ADD COLUMN IF NOT EXISTS private_promo_end_date DATE,
  ADD COLUMN IF NOT EXISTS private_promo_duration_weeks INTEGER CHECK (private_promo_duration_weeks IS NULL OR private_promo_duration_weeks IN (2, 3, 4)),
  ADD COLUMN IF NOT EXISTS private_promo_discount_percent INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS private_promo_sales_summary_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS private_promo_sales_summary_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS private_promo_last_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS private_promo_last_email_stage TEXT,
  ADD COLUMN IF NOT EXISTS private_promo_pos_sales_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS private_promo_credit_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS private_promo_credit_id UUID REFERENCES retailer_credits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS private_promo_credit_issued_at TIMESTAMPTZ;

ALTER TABLE retailer_success_profiles
  DROP CONSTRAINT IF EXISTS retailer_success_profiles_private_promo_status_check;

ALTER TABLE retailer_success_profiles
  ADD CONSTRAINT retailer_success_profiles_private_promo_status_check
  CHECK (private_promo_status IN (
    'not_started',
    'dates_needed',
    'scheduled',
    'active',
    'awaiting_sales_summary',
    'completed',
    'canceled'
  ));

ALTER TABLE retailer_success_profiles
  DROP CONSTRAINT IF EXISTS retailer_success_profiles_private_promo_source_check;

ALTER TABLE retailer_success_profiles
  ADD CONSTRAINT retailer_success_profiles_private_promo_source_check
  CHECK (private_promo_source IS NULL OR private_promo_source IN (
    'welcome_offer',
    'dashboard_request',
    'admin_created'
  ));

ALTER TABLE retailer_success_profiles
  DROP CONSTRAINT IF EXISTS retailer_success_profiles_launch_promo_status_check;

ALTER TABLE retailer_success_profiles
  ADD CONSTRAINT retailer_success_profiles_launch_promo_status_check
  CHECK (launch_promo_status IN (
    'not_requested',
    'requested',
    'dates_needed',
    'scheduled',
    'active',
    'awaiting_sales_summary',
    'completed',
    'canceled'
  ));

ALTER TABLE launch_promo_requests
  ALTER COLUMN start_date DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'dashboard_request',
  ADD COLUMN IF NOT EXISTS retailer_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sales_summary_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sales_summary_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_stage TEXT,
  ADD COLUMN IF NOT EXISTS pos_sales_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS credit_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS credit_id UUID REFERENCES retailer_credits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_issued_at TIMESTAMPTZ;

ALTER TABLE launch_promo_requests
  DROP CONSTRAINT IF EXISTS launch_promo_requests_status_check;

ALTER TABLE launch_promo_requests
  ADD CONSTRAINT launch_promo_requests_status_check
  CHECK (status IN (
    'pending',
    'approved',
    'dates_needed',
    'scheduled',
    'active',
    'awaiting_sales_summary',
    'completed',
    'canceled'
  ));

ALTER TABLE launch_promo_requests
  DROP CONSTRAINT IF EXISTS launch_promo_requests_source_check;

ALTER TABLE launch_promo_requests
  ADD CONSTRAINT launch_promo_requests_source_check
  CHECK (source IN ('welcome_offer', 'dashboard_request', 'admin_created'));

UPDATE launch_promo_requests
SET
  status = CASE
    WHEN status IN ('pending', 'approved') AND start_date IS NOT NULL THEN 'scheduled'
    ELSE status
  END,
  end_date = COALESCE(end_date, (start_date + ((duration_weeks * 7 - 1) || ' days')::INTERVAL)::DATE)
WHERE status IN ('pending', 'approved')
  OR end_date IS NULL;

UPDATE retailer_success_profiles
SET
  private_promo_status = CASE
    WHEN launch_promo_status = 'requested' THEN 'scheduled'
    WHEN launch_promo_status IN ('dates_needed', 'scheduled', 'active', 'awaiting_sales_summary', 'completed', 'canceled') THEN launch_promo_status
    ELSE private_promo_status
  END
WHERE launch_promo_status <> 'not_requested';

CREATE INDEX IF NOT EXISTS idx_launch_promo_requests_status_dates
  ON launch_promo_requests(status, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_retailer_success_profiles_private_promo_status
  ON retailer_success_profiles(private_promo_status, private_promo_start_date, private_promo_end_date);
