-- Sign in with Google (Task 98). google_id is Google's stable id for the person (the token's `sub`);
-- unique, and null for accounts that never used Google. password_hash becomes nullable because an
-- account created through Google has no password (a null hash never matches, so password login
-- simply fails for it; "Forgot password" lets such a user add one).
alter table users add column google_id varchar(255);

create unique index uq_users_google_id on users (google_id);

alter table users alter column password_hash drop not null;
