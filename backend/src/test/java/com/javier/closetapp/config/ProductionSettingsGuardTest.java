package com.javier.closetapp.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Audit H6: the production start-up guard refuses unsafe settings and never repeats a value.
class ProductionSettingsGuardTest {

    private static final String GOOD_KEY = Base64.getEncoder().encodeToString(new byte[48]).replace('A', 'Q');

    private static List<String> check(String jwt, String cors, String frontend, String mail, boolean rate,
                                      String stripeKey, String stripePrice, String stripeHook) {
        return ProductionSettingsGuard.problems(jwt, cors, frontend, mail, rate, stripeKey, stripePrice, stripeHook);
    }

    private static List<String> good() {
        return check(GOOD_KEY, "https://vysvi-web.onrender.com", "https://vysvi-web.onrender.com", "relay", true, "", "", "");
    }

    @Test
    @DisplayName("sensible production settings pass")
    void goodSettingsPass() {
        assertTrue(good().isEmpty(), good().toString());
    }

    @Test
    @DisplayName("a short or non-Base64 signing key is refused")
    void weakKeyIsRefused() {
        assertFalse(check("c2hvcnQ=", "https://a.example", "https://a.example", "relay", true, "", "", "").isEmpty());
        assertFalse(check("not base64 !!", "https://a.example", "https://a.example", "relay", true, "", "", "").isEmpty());
        assertFalse(check("", "https://a.example", "https://a.example", "relay", true, "", "", "").isEmpty());
    }

    @Test
    @DisplayName("a placeholder signing key is refused even when it is valid Base64 and long enough")
    void placeholderKeyIsRefused() {
        List<String> problems = check("changemechangemechangemechangemechangeme1234", "https://a.example", "https://a.example", "relay", true, "", "", "");
        assertEquals(1, problems.size(), problems.toString());
        assertTrue(problems.get(0).contains("placeholder"));
    }

    @Test
    @DisplayName("wildcard, local and plain-http origins are refused")
    void unsafeOriginsAreRefused() {
        assertFalse(check(GOOD_KEY, "*", "https://a.example", "relay", true, "", "", "").isEmpty());
        assertFalse(check(GOOD_KEY, "http://localhost:5173", "https://a.example", "relay", true, "", "", "").isEmpty());
        assertFalse(check(GOOD_KEY, "https://a.example,http://b.example", "https://a.example", "relay", true, "", "", "").isEmpty());
        assertFalse(check(GOOD_KEY, "", "https://a.example", "relay", true, "", "", "").isEmpty());
    }

    @Test
    @DisplayName("a local or plain-http website address is refused")
    void unsafeFrontendUrlIsRefused() {
        assertFalse(check(GOOD_KEY, "https://a.example", "http://localhost:5173", "relay", true, "", "", "").isEmpty());
        assertFalse(check(GOOD_KEY, "https://a.example", "http://a.example", "relay", true, "", "", "").isEmpty());
    }

    @Test
    @DisplayName("the log mailer and a disabled rate limit are refused")
    void mailLogAndRateLimitOffAreRefused() {
        assertFalse(check(GOOD_KEY, "https://a.example", "https://a.example", "log", true, "", "", "").isEmpty());
        assertFalse(check(GOOD_KEY, "https://a.example", "https://a.example", "relay", false, "", "", "").isEmpty());
    }

    @Test
    @DisplayName("Stripe settings must be all set or all empty")
    void partialStripeIsRefused() {
        assertTrue(check(GOOD_KEY, "https://a.example", "https://a.example", "relay", true, "sk", "price", "whsec").isEmpty());
        assertFalse(check(GOOD_KEY, "https://a.example", "https://a.example", "relay", true, "sk", "", "").isEmpty());
        assertFalse(check(GOOD_KEY, "https://a.example", "https://a.example", "relay", true, "sk", "price", "").isEmpty());
    }

    @Test
    @DisplayName("starting with a bad setting fails with a message that names it but never prints a value")
    void startupFailsWithoutLeakingValues() {
        String secretLooking = "super-private-value";
        IllegalStateException e = assertThrows(IllegalStateException.class, () ->
                new ProductionSettingsGuard(secretLooking, "https://a.example", "https://a.example", "relay", true, "", "", ""));
        assertTrue(e.getMessage().contains("JWT_SECRET"));
        assertFalse(e.getMessage().contains(secretLooking));
        assertEquals("Refusing to start in production: ", e.getMessage().substring(0, "Refusing to start in production: ".length()));
    }
}
