-- The account's "main outfit" (Task 78): the outfit shown first on the
-- Showcase and opened by Attire. Nullable - a user with no outfits (or who
-- deleted their main one) simply has none. ON DELETE SET NULL means removing
-- the outfit can never leave a dangling pointer, whatever code path deletes it.
alter table users add column main_outfit_id bigint;

alter table users
    add constraint fk_users_main_outfit
    foreign key (main_outfit_id) references outfits (outfit_id) on delete set null;
