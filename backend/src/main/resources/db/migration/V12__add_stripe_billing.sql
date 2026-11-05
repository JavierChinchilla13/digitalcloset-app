-- Stripe subscription (Task 103). All nullable: an account that never paid has none of these, and an
-- admin-comped PREMIUM plan has no subscription behind it.
alter table users add column stripe_customer_id varchar(64);
alter table users add column stripe_subscription_id varchar(64);
alter table users add column subscription_status varchar(32);
alter table users add column current_period_end timestamp;
alter table users add column cancel_at_period_end boolean not null default false;

create unique index uq_users_stripe_customer on users (stripe_customer_id);
create unique index uq_users_stripe_subscription on users (stripe_subscription_id);

-- Stripe delivers webhooks at least once, so each event id is recorded and handled only once.
create table stripe_events (
    event_id    varchar(255) primary key,
    received_at timestamp not null default current_timestamp
);
