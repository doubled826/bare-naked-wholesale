ALTER TABLE wholesale_leads
  ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS sample_status TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS sample_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS disqualified_reason TEXT,
  ADD COLUMN IF NOT EXISTS disqualified_notes TEXT,
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wholesale_customer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS meta_qualified_event_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_qualified_event_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_qualified_event_processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_qualified_event_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_qualified_event_last_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wholesale_leads_lead_status_check'
  ) THEN
    ALTER TABLE wholesale_leads
      ADD CONSTRAINT wholesale_leads_lead_status_check
      CHECK (lead_status IN ('new', 'qualified', 'disqualified', 'wholesale_customer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wholesale_leads_sample_status_check'
  ) THEN
    ALTER TABLE wholesale_leads
      ADD CONSTRAINT wholesale_leads_sample_status_check
      CHECK (sample_status IN ('not_sent', 'sent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wholesale_leads_disqualified_reason_check'
  ) THEN
    ALTER TABLE wholesale_leads
      ADD CONSTRAINT wholesale_leads_disqualified_reason_check
      CHECK (
        disqualified_reason IN (
          'not_a_retailer',
          'no_verifiable_storefront',
          'outside_service_area',
          'duplicate_request',
          'no_response',
          'other'
        )
        OR disqualified_reason IS NULL
      );
  END IF;
END $$;

UPDATE wholesale_leads
SET
  lead_status = CASE
    WHEN status = 'converted' THEN 'wholesale_customer'
    WHEN status = 'closed' THEN 'disqualified'
    WHEN status IN ('approved', 'sample_pack_pending', 'tracking_added', 'delivered', 'follow_up_due') THEN 'qualified'
    ELSE 'new'
  END,
  sample_status = CASE
    WHEN status IN ('tracking_added', 'delivered') OR tracking_number IS NOT NULL OR tracking_url IS NOT NULL THEN 'sent'
    ELSE 'not_sent'
  END,
  sample_sent_at = COALESCE(sample_sent_at, tracking_added_at),
  qualified_at = CASE
    WHEN status IN ('approved', 'sample_pack_pending', 'tracking_added', 'delivered', 'follow_up_due') THEN COALESCE(qualified_at, approved_at)
    ELSE qualified_at
  END,
  disqualified_at = CASE
    WHEN status = 'closed' THEN COALESCE(disqualified_at, updated_at)
    ELSE disqualified_at
  END,
  wholesale_customer_at = CASE
    WHEN status = 'converted' THEN COALESCE(wholesale_customer_at, converted_at)
    ELSE wholesale_customer_at
  END;

CREATE INDEX IF NOT EXISTS idx_wholesale_leads_lead_status_created
  ON wholesale_leads (lead_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wholesale_leads_sample_status_created
  ON wholesale_leads (sample_status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_leads_meta_qualified_event_id
  ON wholesale_leads (meta_qualified_event_id)
  WHERE meta_qualified_event_id IS NOT NULL;
