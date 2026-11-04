package com.javier.closetapp.billing;

import org.springframework.data.jpa.repository.JpaRepository;

// Task 103: handled webhook events, by Stripe's event id.
public interface StripeEventRepository extends JpaRepository<StripeEventRecord, String> {
}
