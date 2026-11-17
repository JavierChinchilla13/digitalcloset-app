-- Audit backup review (M4): a Google ID token can be used ONCE for "it is me" actions (delete account, backup download) and not if it was
-- already used to sign in. Only a SHA-256 fingerprint of the token is kept (never the token), with the time; rows older than a day are
-- removed as new ones are written (a token is only accepted for minutes anyway).
create table google_token_uses (
    token_hash varchar(64) primary key,
    used_at timestamp not null default now()
);
