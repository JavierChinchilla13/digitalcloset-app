package com.javier.closetapp.billing;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// Task 103: /api/billing. status, checkout and portal need a login; the webhook is public (Stripe
// calls it) and protected by its signature instead.
@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping("/status")
    public BillingStatusResponse status() {
        return billingService.status();
    }

    @PostMapping("/checkout")
    public Map<String, String> checkout() {
        return Map.of("url", billingService.startCheckout());
    }

    @PostMapping("/portal")
    public Map<String, String> portal() {
        return Map.of("url", billingService.openPortal());
    }

    // The raw body is needed exactly as sent: the signature is computed over it.
    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(@RequestBody String payload,
                                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        try {
            billingService.handleWebhook(payload, signature == null ? "" : signature);
        } catch (StripeGateway.InvalidWebhookException e) {
            // 400, not 500: an invalid event must not be retried for days.
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok().build();
    }
}
