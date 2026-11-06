-- Audit H1: lets the server end every login token of one account at once (password reset or change,
-- Google linking, deactivation). Tokens carry the value they were issued with; a bump makes them stale.
-- Existing tokens carry none, which counts as 0, so nobody is signed out by this migration.
alter table users add column token_version integer not null default 0;
