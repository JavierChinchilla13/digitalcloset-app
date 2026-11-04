package com.javier.closetapp.billing;

import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Set;

// Task 103: Premium by Stripe subscription. The browser is sent to Stripe Checkout; Stripe tells this
// server what happened through signed webhooks, and ONLY those change the plan (the success page the
// browser returns to is never trusted). An account's plan is lowered by a subscription event only when
// the event is for the subscription this account actually holds, so a PREMIUM plan given by an admin
// (no subscription) is never touched by a stray event.
@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);
    // Statuses in which the paid plan stays on (past_due: Stripe is still retrying the card).
    private static final Set<String> PAID_STATUSES = Set.of("active", "trialing", "past_due");
    // Statuses in which the paid plan is over.
    private static final Set<String> ENDED_STATUSES = Set.of("canceled", "unpaid", "incomplete_expired");

    private final StripeGateway gateway;
    private final UserRepository userRepository;
    private final StripeEventRepository eventRepository;
    private final String frontendUrl;

    public BillingService(StripeGateway gateway, UserRepository userRepository,
                          StripeEventRepository eventRepository,
                          @Value("${app.frontend-url}") String frontendUrl) {
        this.gateway = gateway;
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional(readOnly = true)
    public BillingStatusResponse status() {
        User user = currentUser();
        return new BillingStatusResponse(
                gateway.isConfigured(),
                user.getPlan(),
                user.getSubscriptionStatus(),
                user.getCurrentPeriodEnd() == null ? null : user.getCurrentPeriodEnd().toString(),
                user.isCancelAtPeriodEnd(),
                user.getStripeCustomerId() != null,
                gateway.isConfigured() ? gateway.priceLabel() : null);
    }

    // The URL of a Stripe Checkout page for the monthly plan.
    @Transactional
    public String startCheckout() {
        requireConfigured();
        User user = currentUser();
        if (user.getRole() == Role.ROLE_ADMIN) {
            throw new BillingException("Admin accounts already have unlimited garments.");
        }
        if (user.getStripeSubscriptionId() != null && user.getSubscriptionStatus() != null
                && PAID_STATUSES.contains(user.getSubscriptionStatus())) {
            throw new BillingException("You already have a Premium subscription. Manage it from the billing page.");
        }
        if (user.getPlan() == Plan.PREMIUM && user.getStripeSubscriptionId() == null) {
            throw new BillingException("Your account already has Premium.");
        }
        if (user.getStripeCustomerId() == null) {
            user.setStripeCustomerId(gateway.createCustomer(user.getEmail(), user.getUserId()));
            userRepository.save(user);
        }
        return gateway.createCheckoutSession(user.getStripeCustomerId(), user.getUserId(),
                frontendUrl + "/settings?billing=success", frontendUrl + "/settings");
    }

    // The URL of Stripe's customer portal (cancel, update the card, invoices).
    @Transactional(readOnly = true)
    public String openPortal() {
        requireConfigured();
        User user = currentUser();
        if (user.getStripeCustomerId() == null) {
            throw new BillingException("There is no subscription to manage yet.");
        }
        return gateway.createPortalSession(user.getStripeCustomerId(), frontendUrl + "/settings");
    }

    // Handles one webhook: verified, deduplicated by event id, then applied to the matching account.
    @Transactional
    public void handleWebhook(String payload, String signatureHeader) {
        BillingEvent event = gateway.parseWebhook(payload, signatureHeader);
        if (event == null) return; // a type the app does not act on

        // Stripe delivers at least once: an event id already seen is done.
        if (eventRepository.existsById(event.eventId())) return;
        try {
            eventRepository.saveAndFlush(new StripeEventRecord(event.eventId()));
        } catch (DataIntegrityViolationException duplicate) {
            return; // a parallel delivery of the same event got there first
        }

        switch (event.type()) {
            case CHECKOUT_COMPLETED -> onCheckoutCompleted(event);
            case SUBSCRIPTION_UPDATED, SUBSCRIPTION_DELETED -> onSubscriptionChanged(event);
        }
    }

    private void onCheckoutCompleted(BillingEvent event) {
        if (event.userId() == null || event.subscriptionId() == null) return;
        User user = userRepository.findByIdForUpdate(event.userId()).orElse(null);
        if (user == null) {
            log.warn("Stripe checkout for an unknown user {}", event.userId());
            return;
        }
        if (event.customerId() != null) user.setStripeCustomerId(event.customerId());
        user.setStripeSubscriptionId(event.subscriptionId());
        user.setSubscriptionStatus("active");
        user.setCancelAtPeriodEnd(false);
        if (user.getRole() != Role.ROLE_ADMIN) user.setPlan(Plan.PREMIUM);
        userRepository.save(user);
    }

    private void onSubscriptionChanged(BillingEvent event) {
        if (event.customerId() == null) return;
        User user = userRepository.findByStripeCustomerId(event.customerId()).orElse(null);
        if (user == null) return;
        // Only the subscription this account holds can change its plan (a comped PREMIUM has none).
        // The first subscription event may arrive before the checkout event: adopt the id then.
        if (user.getStripeSubscriptionId() != null && !user.getStripeSubscriptionId().equals(event.subscriptionId())) {
            return;
        }
        if (user.getStripeSubscriptionId() == null && event.type() == BillingEvent.Type.SUBSCRIPTION_DELETED) {
            return;
        }

        String status = event.type() == BillingEvent.Type.SUBSCRIPTION_DELETED ? "canceled" : event.status();
        user.setSubscriptionStatus(status);
        user.setCancelAtPeriodEnd(event.cancelAtPeriodEnd());
        if (event.currentPeriodEnd() != null) {
            user.setCurrentPeriodEnd(LocalDateTime.ofInstant(event.currentPeriodEnd(), ZoneOffset.UTC));
        }
        if (user.getStripeSubscriptionId() == null) user.setStripeSubscriptionId(event.subscriptionId());

        if (status != null && PAID_STATUSES.contains(status)) {
            if (user.getRole() != Role.ROLE_ADMIN) user.setPlan(Plan.PREMIUM);
        } else if (status != null && ENDED_STATUSES.contains(status)) {
            if (user.getRole() != Role.ROLE_ADMIN) user.setPlan(Plan.FREE);
            // The subscription is over: free the slot so the account can subscribe again.
            user.setStripeSubscriptionId(null);
            user.setCancelAtPeriodEnd(false);
        }
        userRepository.save(user);
    }

    // Best effort when an account is deactivated: stop charging it. A failure is logged, not raised, so
    // deactivation itself is never blocked by Stripe being unreachable.
    public void cancelSubscriptionQuietly(User user) {
        if (user.getStripeSubscriptionId() == null || !gateway.isConfigured()) return;
        try {
            gateway.cancelSubscription(user.getStripeSubscriptionId());
        } catch (RuntimeException e) {
            log.warn("Could not cancel the Stripe subscription of user {}: {}", user.getUserId(), e.getMessage());
        }
    }

    private void requireConfigured() {
        if (!gateway.isConfigured()) {
            throw new BillingException("Payments are not set up yet.");
        }
    }
}
