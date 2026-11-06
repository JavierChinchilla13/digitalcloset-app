-- Audit M8: an email is one account whatever its capitals ("Bob@x.com" and "bob@x.com" were two accounts).
-- Existing addresses are lower-cased (an address that would collide with another account is left as it is),
-- and the database now refuses a second account that differs only by case. If such a pair already exists the
-- index is skipped with a notice (the application still treats the older account as the match); resolve the
-- pair by hand, then create the index.
update users set email = lower(email)
 where email <> lower(email)
   and not exists (select 1 from users other where lower(other.email) = lower(users.email) and other.user_id <> users.user_id);

do $$
begin
    create unique index uq_users_email_lower on users (lower(email));
exception when unique_violation then
    raise notice 'uq_users_email_lower not created: two accounts differ only by the case of their email';
end $$;
