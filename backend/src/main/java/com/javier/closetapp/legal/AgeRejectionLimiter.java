package com.javier.closetapp.legal;

import com.javier.closetapp.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

// Audit H12: stops someone from trying birth dates one after another until one is accepted. It counts the sign-ups that
// were REFUSED for age, per client address, in memory only (nothing about the person is written anywhere), and after
// `max` refusals inside the window it answers 429 for the rest of the window.
//
// BUILT BUT OFF by default (app.rate-limit.age-rejection.enabled=false). Behind Render's proxy the address the app sees
// may be the proxy's, in which case every visitor would share one counter and a handful of refusals would lock everyone
// out of sign-up; it stays off until the real client address has been measured (audit H2). To switch it on, set
// RATE_LIMIT_AGE_REJECTION_ENABLED=true on the API (see DEPLOYMENT.md). Size the limit for shared mobile networks.
@Component
public class AgeRejectionLimiter {
    private static final int SWEEP_THRESHOLD = 10_000;

    private final boolean enabled;
    private final int max;
    private final long windowMillis;
    private final LongSupplier clock;
    private final ConcurrentHashMap<String, Deque<Long>> refusals = new ConcurrentHashMap<>();

    @Autowired
    public AgeRejectionLimiter(
            @Value("${app.rate-limit.age-rejection.enabled:false}") boolean enabled,
            @Value("${app.rate-limit.age-rejection.max:5}") int max,
            @Value("${app.rate-limit.age-rejection.window-seconds:3600}") long windowSeconds) {
        this(enabled, max, windowSeconds * 1000, System::currentTimeMillis);
    }

    // For tests: an injectable clock.
    AgeRejectionLimiter(boolean enabled, int max, long windowMillis, LongSupplier clock) {
        this.enabled = enabled;
        this.max = max;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    // Call before processing a sign-up: refuses (429) an address that has already been refused too often.
    public void requireNotBlocked(String address) {
        if (!enabled) return;
        long now = clock.getAsLong();
        Deque<Long> times = refusals.get(address);
        if (times == null) return;
        synchronized (times) {
            prune(times, now);
            if (times.size() >= max) {
                throw new TooManyRequestsException("Too many attempts. Please try again later.");
            }
        }
    }

    // Call when a sign-up was refused for age.
    public void recordRejection(String address) {
        if (!enabled) return;
        long now = clock.getAsLong();
        if (refusals.size() > SWEEP_THRESHOLD) {
            refusals.values().removeIf(d -> { synchronized (d) { prune(d, now); return d.isEmpty(); } });
        }
        Deque<Long> times = refusals.computeIfAbsent(address, a -> new ArrayDeque<>());
        synchronized (times) {
            prune(times, now);
            times.addLast(now);
        }
    }

    private void prune(Deque<Long> times, long now) {
        while (!times.isEmpty() && now - times.peekFirst() >= windowMillis) {
            times.pollFirst();
        }
    }
}
