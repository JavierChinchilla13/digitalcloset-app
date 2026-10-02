-- Layer order (Task 86): where a piece sits in the stack on the persona, 0 =
-- bottom-most. Nullable on purpose: NULL means "no custom order", so the
-- persona keeps stacking by category (pants, shoes, dresses, tops, jackets,
-- accessories) exactly as every outfit saved before this column existed.
-- Deliberately NOT item_order, which means click order / category order and
-- would flip existing outfits if reinterpreted as a stacking order.
alter table outfit_items add column layer_order integer;
