package com.javier.closetapp.integration;

import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.support.FakeStripeGateway;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 103: Premium by Stripe subscription. Stripe is a fake (FakeStripeGateway); the webhook goes through
// the real endpoint, the real event mapping and the real account rules.
class BillingIntegrationTest extends IntegrationTestBase {

    @Autowired private FakeStripeGateway stripe;

    @BeforeEach
    void resetFake() {
        stripe.reset();
    }

    private User reload(TestUser user) {
        return userRepository.findByEmail(user.email()).orElseThrow();
    }

    private void webhook(String body, String signature) throws Exception {
        mockMvc.perform(post("/api/billing/webhook")
                        .header("Stripe-Signature", signature)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    private String checkoutCompleted(String eventId, long userId, String customer, String subscription) {
        return "{\"id\":\"" + eventId + "\",\"type\":\"checkout.session.completed\",\"data\":{\"object\":{"
                + "\"mode\":\"subscription\",\"client_reference_id\":\"" + userId + "\","
                + "\"customer\":\"" + customer + "\",\"subscription\":\"" + subscription + "\"}}}";
    }

    private String subscriptionEvent(String eventId, String type, String customer, String subscription, String statusWord,
                                     boolean cancelAtEnd, long periodEnd) {
        return "{\"id\":\"" + eventId + "\",\"type\":\"" + type + "\",\"data\":{\"object\":{"
                + "\"id\":\"" + subscription + "\",\"customer\":\"" + customer + "\",\"status\":\"" + statusWord + "\","
                + "\"cancel_at_period_end\":" + cancelAtEnd + ",\"current_period_end\":" + periodEnd + "}}}";
    }

    private String uid() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    @DisplayName("status says billing is on, the plan, and the price")
    void statusReportsBilling() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(get("/api/billing/status").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.canManage").value(false))
                .andExpect(jsonPath("$.priceLabel").value("4.99 USD / month"));
    }

    @Test
    @DisplayName("status says billing is off when Stripe is not configured")
    void statusWhenOff() throws Exception {
        stripe.configured = false;
        TestUser alice = registerUser();

        mockMvc.perform(get("/api/billing/status").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.priceLabel").doesNotExist());
    }

    @Test
    @DisplayName("checkout creates the Stripe customer once and returns the Checkout URL")
    void checkout() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/billing/checkout").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(containsString("checkout.stripe.test")));
        mockMvc.perform(post("/api/billing/checkout").header("Authorization", alice.bearer()))
                .andExpect(status().isOk());

        assertEquals(1, stripe.createdCustomers.size());
        assertEquals("cus_test_" + alice.userId(), reload(alice).getStripeCustomerId());
        // The plan does not change until Stripe says the payment happened.
        assertEquals(Plan.FREE, reload(alice).getPlan());
    }

    @Test
    @DisplayName("checkout is refused with a message when payments are not set up")
    void checkoutWhenOff() throws Exception {
        stripe.configured = false;
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/billing/checkout").header("Authorization", alice.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("not set up")));
    }

    @Test
    @DisplayName("checkout and portal need a login")
    void needLogin() throws Exception {
        mockMvc.perform(post("/api/billing/checkout")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/billing/portal")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/billing/status")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("an admin or an admin-comped Premium account is not sent to pay")
    void notForAdminsOrComped() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        TestUser comped = registerUser();
        setPlan(comped, Plan.PREMIUM);

        mockMvc.perform(post("/api/billing/checkout").header("Authorization", admin.bearer()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/billing/checkout").header("Authorization", comped.bearer()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("the portal needs a Stripe customer, then returns its URL")
    void portal() throws Exception {
        TestUser alice = registerUser();
        mockMvc.perform(post("/api/billing/portal").header("Authorization", alice.bearer()))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/billing/checkout").header("Authorization", alice.bearer())).andExpect(status().isOk());
        mockMvc.perform(post("/api/billing/portal").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(containsString("billing.stripe.test")));
    }

    @Test
    @DisplayName("a paid checkout makes the account Premium and lifts the 15-garment limit")
    void upgradeRaisesTheLimit() throws Exception {
        TestUser alice = registerUser();
        createItems(alice, 15);
        postItem(alice, "one-too-many").andExpect(status().isForbidden());

        webhook(checkoutCompleted("evt_" + uid(), alice.userId(), "cus_" + uid(), "sub_" + uid()), "valid");

        assertEquals(Plan.PREMIUM, reload(alice).getPlan());
        postItem(alice, "now-fits").andExpect(status().isOk());
        mockMvc.perform(get("/api/billing/status").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$.plan").value("PREMIUM"))
                .andExpect(jsonPath("$.subscriptionStatus").value("active"))
                .andExpect(jsonPath("$.canManage").value(true));
    }

    @Test
    @DisplayName("an event with a bad signature is a 400 and changes nothing")
    void badSignature() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/billing/webhook")
                        .header("Stripe-Signature", "forged")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutCompleted("evt_" + uid(), alice.userId(), "cus_x", "sub_x")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/billing/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        assertEquals(Plan.FREE, reload(alice).getPlan());
    }

    @Test
    @DisplayName("a redelivered event is applied once")
    void replayIsIgnored() throws Exception {
        TestUser alice = registerUser();
        String customer = "cus_" + uid();
        String subscription = "sub_" + uid();
        String event = checkoutCompleted("evt_" + uid(), alice.userId(), customer, subscription);

        webhook(event, "valid");
        // Pretend something moved the plan since (an admin edit): a replay must not undo it.
        setPlan(alice, Plan.FREE);
        webhook(event, "valid");

        assertEquals(Plan.FREE, reload(alice).getPlan());
    }

    @Test
    @DisplayName("a cancelled subscription returns the account to Free")
    void cancelDowngrades() throws Exception {
        TestUser alice = registerUser();
        String customer = "cus_" + uid();
        String subscription = "sub_" + uid();
        webhook(checkoutCompleted("evt_" + uid(), alice.userId(), customer, subscription), "valid");

        webhook(subscriptionEvent("evt_" + uid(), "customer.subscription.deleted", customer, subscription, "canceled", false, 1893456000L), "valid");

        User user = reload(alice);
        assertEquals(Plan.FREE, user.getPlan());
        assertEquals("canceled", user.getSubscriptionStatus());
        assertNull(user.getStripeSubscriptionId());
    }

    @Test
    @DisplayName("cancel-at-period-end keeps Premium and records when it ends")
    void cancelAtPeriodEndKeepsPremium() throws Exception {
        TestUser alice = registerUser();
        String customer = "cus_" + uid();
        String subscription = "sub_" + uid();
        webhook(checkoutCompleted("evt_" + uid(), alice.userId(), customer, subscription), "valid");

        webhook(subscriptionEvent("evt_" + uid(), "customer.subscription.updated", customer, subscription, "active", true, 1893456000L), "valid");

        User user = reload(alice);
        assertEquals(Plan.PREMIUM, user.getPlan());
        assertTrue(user.isCancelAtPeriodEnd());
        assertTrue(user.getCurrentPeriodEnd().toString().startsWith("2030-01-01"));
    }

    @Test
    @DisplayName("an unpaid subscription downgrades, a past-due one keeps Premium while Stripe retries")
    void statuses() throws Exception {
        TestUser alice = registerUser();
        String customer = "cus_" + uid();
        String subscription = "sub_" + uid();
        webhook(checkoutCompleted("evt_" + uid(), alice.userId(), customer, subscription), "valid");

        webhook(subscriptionEvent("evt_" + uid(), "customer.subscription.updated", customer, subscription, "past_due", false, 1893456000L), "valid");
        assertEquals(Plan.PREMIUM, reload(alice).getPlan());

        webhook(subscriptionEvent("evt_" + uid(), "customer.subscription.updated", customer, subscription, "unpaid", false, 1893456000L), "valid");
        assertEquals(Plan.FREE, reload(alice).getPlan());
    }

    @Test
    @DisplayName("an event for another subscription never touches an admin-comped Premium account")
    void compedPremiumIsSafe() throws Exception {
        TestUser comped = registerUser();
        setPlan(comped, Plan.PREMIUM);
        // The account once opened Checkout (so it has a customer) but never paid.
        var entity = reload(comped);
        entity.setStripeCustomerId("cus_" + comped.userId());
        userRepository.save(entity);

        webhook(subscriptionEvent("evt_" + uid(), "customer.subscription.deleted", "cus_" + comped.userId(), "sub_old", "canceled", false, 1893456000L), "valid");

        assertEquals(Plan.PREMIUM, reload(comped).getPlan());
    }

    @Test
    @DisplayName("an event that belongs to a different subscription than the account holds is ignored")
    void staleSubscriptionIgnored() throws Exception {
        TestUser alice = registerUser();
        String customer = "cus_" + uid();
        webhook(checkoutCompleted("evt_" + uid(), alice.userId(), customer, "sub_current"), "valid");

        webhook(subscriptionEvent("evt_" + uid(), "customer.subscription.deleted", customer, "sub_previous", "canceled", false, 1893456000L), "valid");

        assertEquals(Plan.PREMIUM, reload(alice).getPlan());
    }

    @Test
    @DisplayName("an event type the app does not use is accepted and ignored")
    void unknownEventTypes() throws Exception {
        webhook("{\"id\":\"evt_" + uid() + "\",\"type\":\"invoice.created\",\"data\":{\"object\":{}}}", "valid");
    }

    @Test
    @DisplayName("deactivating a subscribed account cancels its subscription, and Stripe being down does not block it")
    void deactivationCancelsTheSubscription() throws Exception {
        TestUser alice = registerUser();
        String subscription = "sub_" + uid();
        webhook(checkoutCompleted("evt_" + uid(), alice.userId(), "cus_" + uid(), subscription), "valid");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/users/me/deactivate")
                        .header("Authorization", alice.bearer()))
                .andExpect(status().is2xxSuccessful());
        assertTrue(stripe.canceledSubscriptions.contains(subscription));

        stripe.failCancel = true;
        TestUser bob = registerUser();
        webhook(checkoutCompleted("evt_" + uid(), bob.userId(), "cus_" + uid(), "sub_" + uid()), "valid");
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/users/me/deactivate")
                        .header("Authorization", bob.bearer()))
                .andExpect(status().is2xxSuccessful());
        assertEquals(false, reload(bob).isActive());
    }
}
