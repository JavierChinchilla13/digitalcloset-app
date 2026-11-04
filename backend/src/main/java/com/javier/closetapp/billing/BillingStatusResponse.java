package com.javier.closetapp.billing;

import com.javier.closetapp.common.enums.Plan;

// Task 103: what the account's billing looks like to the frontend. `enabled` false = billing is not set
// up on this server (no upgrade buttons are shown). `canManage` = there is a Stripe customer to open the
// portal for. `currentPeriodEnd` is an ISO date-time; with `cancelAtPeriodEnd` it reads "ends on ...".
public record BillingStatusResponse(
        boolean enabled,
        Plan plan,
        String subscriptionStatus,
        String currentPeriodEnd,
        boolean cancelAtPeriodEnd,
        boolean canManage,
        String priceLabel) {
}
