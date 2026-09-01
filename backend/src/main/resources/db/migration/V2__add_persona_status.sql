-- Adds ClothingItem.personaStatus (Task 29, Phase 7 pivot): whether an item
-- can be shown on the persona. Additive and backward-compatible - every
-- existing row went through mandatory fitting before this column existed,
-- so FITTED is the correct backfill (the DEFAULT applies to existing rows
-- too, since it's set before the NOT NULL constraint is enforced).

alter table clothing_items
    add column persona_status varchar(255) not null default 'FITTED'
    check (persona_status in ('FITTED','NOT_FITTED','INELIGIBLE_NO_CUTOUT'));
