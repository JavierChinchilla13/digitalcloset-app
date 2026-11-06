package com.javier.closetapp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

// Audit H6: in production the API refuses to start with a setting that would silently make it unsafe,
// instead of failing later (a weak signing key only breaks at the first login) or never (open CORS).
// Every message names the setting, never its value, so nothing secret reaches the logs.
@Component
@Profile("prod")
public class ProductionSettingsGuard {

    public ProductionSettingsGuard(
            @Value("${app.jwt.secret}") String jwtSecret,
            @Value("${app.cors.allowed-origins}") String corsOrigins,
            @Value("${app.frontend-url}") String frontendUrl,
            @Value("${app.mail.mode}") String mailMode,
            @Value("${app.rate-limit.enabled}") boolean rateLimitEnabled,
            @Value("${app.stripe.secret-key:}") String stripeSecretKey,
            @Value("${app.stripe.price-id:}") String stripePriceId,
            @Value("${app.stripe.webhook-secret:}") String stripeWebhookSecret) {
        List<String> problems = problems(jwtSecret, corsOrigins, frontendUrl, mailMode, rateLimitEnabled,
                stripeSecretKey, stripePriceId, stripeWebhookSecret);
        if (!problems.isEmpty()) {
            throw new IllegalStateException("Refusing to start in production: " + String.join("; ", problems));
        }
    }

    // Everything wrong with the given production settings (empty when they are fine). Pure, so it is unit-tested.
    public static List<String> problems(String jwtSecret, String corsOrigins, String frontendUrl, String mailMode,
                                        boolean rateLimitEnabled, String stripeSecretKey, String stripePriceId,
                                        String stripeWebhookSecret) {
        List<String> problems = new ArrayList<>();

        // The login-token key: valid Base64 and at least 256 bits (what HS256 needs), not a placeholder.
        byte[] key = null;
        try {
            key = Base64.getDecoder().decode(jwtSecret == null ? "" : jwtSecret.trim());
        } catch (IllegalArgumentException notBase64) {
            problems.add("JWT_SECRET is not valid Base64 (generate one with: openssl rand -base64 64)");
        }
        if (key != null && key.length < 32) {
            problems.add("JWT_SECRET is shorter than 32 bytes (generate one with: openssl rand -base64 64)");
        }
        if (jwtSecret != null && looksLikePlaceholder(jwtSecret)) {
            problems.add("JWT_SECRET looks like a placeholder, not a generated key");
        }

        // Which websites may call the API: exact https addresses, no wildcard, nothing local.
        for (String origin : split(corsOrigins)) {
            if (origin.contains("*")) {
                problems.add("CORS_ALLOWED_ORIGINS contains a wildcard");
            } else if (!origin.startsWith("https://") || isLocal(origin)) {
                problems.add("CORS_ALLOWED_ORIGINS must list only public https addresses");
            }
        }
        if (split(corsOrigins).isEmpty()) {
            problems.add("CORS_ALLOWED_ORIGINS is empty");
        }

        // Links in emails (password reset) and Stripe return pages are built from this address.
        if (frontendUrl == null || !frontendUrl.startsWith("https://") || isLocal(frontendUrl)) {
            problems.add("FRONTEND_URL must be the public https address of the website");
        }

        // The "log" mailer prints password-reset links and codes to the log.
        if ("log".equalsIgnoreCase(mailMode == null ? "" : mailMode.trim())) {
            problems.add("MAIL_MODE=log prints reset links to the log; use relay or smtp");
        }

        if (!rateLimitEnabled) {
            problems.add("RATE_LIMIT_ENABLED is false; sign-in and public endpoints would be unprotected");
        }

        // Payments are all on or all off: a half-set Stripe configuration fails at the first checkout.
        int stripeSet = (isBlank(stripeSecretKey) ? 0 : 1) + (isBlank(stripePriceId) ? 0 : 1) + (isBlank(stripeWebhookSecret) ? 0 : 1);
        if (stripeSet != 0 && stripeSet != 3) {
            problems.add("STRIPE_SECRET_KEY, STRIPE_PRICE_ID and STRIPE_WEBHOOK_SECRET must be set together (or all left empty)");
        }
        return problems;
    }

    private static boolean looksLikePlaceholder(String value) {
        String v = value.toLowerCase(Locale.ROOT);
        return v.contains("changeme") || v.contains("change-me") || v.contains("placeholder")
                || v.contains("your-secret") || v.contains("example") || v.contains("dev-only");
    }

    private static boolean isLocal(String address) {
        String a = address.toLowerCase(Locale.ROOT);
        return a.contains("localhost") || a.contains("127.0.0.1") || a.contains("[::1]") || a.contains("0.0.0.0");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static List<String> split(String csv) {
        List<String> parts = new ArrayList<>();
        if (csv == null) return parts;
        for (String part : csv.split(",")) {
            if (!part.isBlank()) parts.add(part.trim());
        }
        return parts;
    }
}
