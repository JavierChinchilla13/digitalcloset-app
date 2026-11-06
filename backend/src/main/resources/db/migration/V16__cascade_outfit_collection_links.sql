-- Audit H3: deleting an outfit that sits in a category failed on the foreign key (the membership row still
-- pointed at it). The application now removes the membership rows first; this makes the database do the same as
-- a backstop, so no other path can leave an outfit undeletable.
alter table collection_outfits drop constraint fk_collection_outfits_outfit;
alter table collection_outfits
    add constraint fk_collection_outfits_outfit
    foreign key (outfit_id) references outfits on delete cascade;
