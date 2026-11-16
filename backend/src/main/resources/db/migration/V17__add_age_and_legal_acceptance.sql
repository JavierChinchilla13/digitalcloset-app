-- Audit H12 (area 7): what the app records about age and acceptance, per account.
--  - birth month and year only (never the day); the age band is worked out on the server each time, never stored;
--  - the guardian declaration (a DECLARATION, not a verification) with its time;
--  - the version of the Terms/Privacy the person accepted, and when, and when they authorised the processing and
--    the transfer of their data to the providers abroad (separate from accepting the Terms).
-- Old accounts have none of this (all null / false): they are asked once at their next sign-in.
-- Someone refused for being under the minimum age is never written anywhere.
alter table users
    add column birth_year integer,
    add column birth_month integer,
    add column guardian_authorized boolean not null default false,
    add column guardian_authorized_at timestamp,
    add column terms_version varchar(32),
    add column terms_accepted_at timestamp,
    add column data_authorized_at timestamp;
