-- Public share link of an outfit (Task 102). NULL = not shared. The token is random (never the sequential id),
-- unique, and revoking the link sets it back to NULL.
alter table outfits add column share_token varchar(64);
create unique index uq_outfits_share_token on outfits (share_token);
