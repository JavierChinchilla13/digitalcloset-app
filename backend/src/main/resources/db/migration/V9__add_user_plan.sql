-- The account's plan (Task 96): FREE (the default, 15 garments) or PREMIUM (300 garments, no ads).
-- Admins are unlimited through their role, not through a plan. Existing accounts become FREE.
-- There is no payment flow yet - an admin sets the plan from the Admin page.
alter table users
    add column plan varchar(20) not null default 'FREE'
    constraint chk_users_plan check (plan in ('FREE', 'PREMIUM'));
