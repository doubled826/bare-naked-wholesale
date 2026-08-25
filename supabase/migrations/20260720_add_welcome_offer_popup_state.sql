ALTER TABLE welcome_offer_reminder_preferences
  ADD COLUMN IF NOT EXISTS welcome_offer_initial_popup_seen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE welcome_offer_reminder_preferences
  ADD COLUMN IF NOT EXISTS welcome_offer_initial_popup_seen_at TIMESTAMPTZ;

ALTER TABLE welcome_offer_reminder_preferences
  ADD COLUMN IF NOT EXISTS welcome_offer_last_popup_viewed_at TIMESTAMPTZ;
