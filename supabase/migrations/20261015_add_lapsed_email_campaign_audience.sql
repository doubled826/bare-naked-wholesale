ALTER TABLE email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_audience_filter_check;

ALTER TABLE email_campaigns
  ADD CONSTRAINT email_campaigns_audience_filter_check
  CHECK (
    audience_filter IN (
      'all_retailers',
      'never_ordered',
      'ordered_once',
      'repeat_buyers',
      'lapsed_180_days',
      'manual'
    )
  );
