CREATE TABLE IF NOT EXISTS welcome_offer_reminder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  days_remaining INTEGER NOT NULL DEFAULT 0,
  reminder_sequence_status TEXT NOT NULL
    CHECK (reminder_sequence_status IN (
      'enrolled',
      'already_enrolled',
      'ineligible',
      'failed',
      'enrolled_failed',
      'already_enrolled_failed',
      'ineligible_failed'
    )),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS welcome_offer_reminder_preferences (
  retailer_id UUID PRIMARY KEY REFERENCES retailers(id) ON DELETE CASCADE,
  remind_me_later_requested BOOLEAN NOT NULL DEFAULT false,
  welcome_offer_initial_popup_seen BOOLEAN NOT NULL DEFAULT false,
  welcome_offer_initial_popup_seen_at TIMESTAMPTZ,
  welcome_offer_last_popup_viewed_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE welcome_offer_reminder_preferences
  ADD COLUMN IF NOT EXISTS welcome_offer_initial_popup_seen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE welcome_offer_reminder_preferences
  ADD COLUMN IF NOT EXISTS welcome_offer_initial_popup_seen_at TIMESTAMPTZ;

ALTER TABLE welcome_offer_reminder_preferences
  ADD COLUMN IF NOT EXISTS welcome_offer_last_popup_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_welcome_offer_reminder_requests_retailer
  ON welcome_offer_reminder_requests(retailer_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_welcome_offer_reminder_preferences_opted_out
  ON welcome_offer_reminder_preferences(opted_out_at)
  WHERE opted_out_at IS NOT NULL;

ALTER TABLE welcome_offer_reminder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_offer_reminder_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailers can create their own Welcome Offer reminder requests"
  ON welcome_offer_reminder_requests FOR INSERT
  WITH CHECK (retailer_id = auth.uid());

CREATE POLICY "Admins can manage Welcome Offer reminder requests"
  ON welcome_offer_reminder_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Retailers can view their own Welcome Offer reminder preference"
  ON welcome_offer_reminder_preferences FOR SELECT
  USING (retailer_id = auth.uid());

CREATE POLICY "Retailers can update their own Welcome Offer reminder preference"
  ON welcome_offer_reminder_preferences FOR UPDATE
  USING (retailer_id = auth.uid())
  WITH CHECK (retailer_id = auth.uid());

CREATE POLICY "Admins can manage Welcome Offer reminder preferences"
  ON welcome_offer_reminder_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

ALTER TABLE bare_launch_offer_email_reminders
  DROP CONSTRAINT IF EXISTS bare_launch_offer_email_reminders_template_key_check;

ALTER TABLE bare_launch_offer_email_reminders
  ADD CONSTRAINT bare_launch_offer_email_reminders_template_key_check
  CHECK (template_key IN (
    'bare_launch_offer_remind_me_later',
    'bare_launch_offer_day_1',
    'bare_launch_offer_day_4',
    'bare_launch_offer_day_9',
    'bare_launch_offer_final'
  ));
