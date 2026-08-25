ALTER TABLE welcome_offer_reminder_preferences
  ADD COLUMN IF NOT EXISTS shelf_talker_popup_seen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE welcome_offer_reminder_preferences
  ADD COLUMN IF NOT EXISTS shelf_talker_popup_seen_at TIMESTAMPTZ;
