package com.javier.closetapp.billing;

import com.javier.closetapp.user.service.UserService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

// Signed-in only (the general rule of the API). POST records the request (idempotent); GET says whether this account already requested.
// The admin count is on /api/admin/premium-interest (admin only).
@RestController
public class PremiumInterestController {

    private final PremiumInterestService service;
    private final UserService userService;

    public PremiumInterestController(PremiumInterestService service, UserService userService) {
        this.service = service;
        this.userService = userService;
    }

    @GetMapping("/api/billing/premium-interest")
    public PremiumInterestService.State status() {
        return service.status(userService.getAuthenticatedUser());
    }

    @PostMapping("/api/billing/premium-interest")
    public PremiumInterestService.State request() {
        return service.request(userService.getAuthenticatedUser());
    }

    @GetMapping("/api/admin/premium-interest")
    @PreAuthorize("hasRole('ADMIN')")
    public PremiumInterestService.Summary summary() {
        return service.summary();
    }
}
