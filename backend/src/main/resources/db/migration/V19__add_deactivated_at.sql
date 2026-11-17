-- Audit H12 (area 7): when an account was deactivated, so accounts that have stayed deactivated for 30 days can be erased by the
-- owner-run purge (scripts/purge-deactivated.sh). Set when an admin deactivates, cleared when an admin reactivates.
-- Accounts that are ALREADY deactivated when this runs start their 30 days now (nobody is erased the day this is deployed).
alter table users add column deactivated_at timestamp;
update users set deactivated_at = now() where active = false;
