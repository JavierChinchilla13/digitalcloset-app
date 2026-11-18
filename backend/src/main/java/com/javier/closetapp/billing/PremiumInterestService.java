package com.javier.closetapp.billing;

import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.legal.AccountAge;
import com.javier.closetapp.legal.AgePolicy.AgeBand;
import com.javier.closetapp.user.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// "Request Premium", for the time Stripe is not switched on: an adult who has confirmed their details says they would want Premium.
// One row per account, idempotent (a second request answers "requested" again, with the original date, and sends no second email). Only the
// account number and the date are stored. The owner is emailed with the total; if the email fails the request is still kept.
// Nothing here touches the Stripe code: it only asks the gateway whether billing is configured (the same all-or-none rule).
@Service
public class PremiumInterestService {

    private static final Logger log = LoggerFactory.getLogger(PremiumInterestService.class);

    public record State(boolean requested, LocalDateTime requestedAt) { }

    public record Summary(long count, LocalDateTime latestAt) { }

    private final PremiumInterestRepository repository;
    private final PremiumInterestMailer mailer;
    private final PremiumInterestLimiter limiter;
    private final StripeGateway gateway;

    public PremiumInterestService(PremiumInterestRepository repository, PremiumInterestMailer mailer, PremiumInterestLimiter limiter,
                                  StripeGateway gateway) {
        this.repository = repository;
        this.mailer = mailer;
        this.limiter = limiter;
        this.gateway = gateway;
    }

    public State status(User user) {
        return repository.findByUserId(user.getUserId())
                .map(row -> new State(true, row.getCreatedAt()))
                .orElse(new State(false, null));
    }

    public State request(User user) {
        long userId = user.getUserId();
        limiter.acquire(userId);

        // The same rule that gates Premium itself: declared adult, details confirmed (403 otherwise).
        AgeBand band = AccountAge.bandOf(user);
        if (band == null) {
            throw new ForbiddenOperationException("Please confirm your details first.");
        }
        if (band != AgeBand.ADULT) {
            throw new ForbiddenOperationException("Premium is available to people who are 18 or older.");
        }
        if (user.getRole() == Role.ROLE_ADMIN || user.getPlan() == Plan.PREMIUM) {
            throw new BillingException("Your account already has everything Premium offers.");
        }
        if (gateway.isConfigured()) {
            throw new BillingException("Premium can be bought now: use the Upgrade button.");
        }

        var existing = repository.findByUserId(userId);
        if (existing.isPresent()) return new State(true, existing.get().getCreatedAt());

        // Microseconds, as the database stores them, so the date answered now is exactly the date answered later.
        PremiumInterest saved;
        try {
            saved = repository.saveAndFlush(new PremiumInterest(userId, LocalDateTime.now(ZoneOffset.UTC).truncatedTo(java.time.temporal.ChronoUnit.MICROS)));
        } catch (DataIntegrityViolationException twoClicksAtOnce) {
            return status(user);          // the other request got there first: same answer
        }

        try {
            mailer.notifyNewRequest(userId, repository.count());
        } catch (RuntimeException e) {
            // Without the exception's message; only the account number. The request is kept and the person still sees "Requested".
            log.warn("The Premium request notification could not be sent for user id {} ({})", userId, e.getClass().getSimpleName());
        }
        return new State(true, saved.getCreatedAt());
    }

    // For the admin page: how many requests, and when the latest one was. No account is identified.
    public Summary summary() {
        return new Summary(repository.count(), repository.findFirstByOrderByCreatedAtDesc().map(PremiumInterest::getCreatedAt).orElse(null));
    }
}
