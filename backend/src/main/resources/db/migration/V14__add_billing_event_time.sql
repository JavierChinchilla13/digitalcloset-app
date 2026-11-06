-- Audit H5: when the newest Stripe event applied to this account was created (Stripe's own clock).
-- Stripe does not deliver events in order; a late, older event must not undo a newer one (for example a
-- stale "active" update arriving after the subscription was deleted).
alter table users add column billing_event_at timestamp;
