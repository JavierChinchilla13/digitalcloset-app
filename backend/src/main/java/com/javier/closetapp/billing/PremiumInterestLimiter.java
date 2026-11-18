package com.javier.closetapp.billing;

import com.javier.closetapp.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

// A per-account limit on "Request Premium" (the app's general rate limit only covers the sign-in endpoints, so this endpoint has its own):
// at most `max` calls per account in each `windowSeconds`, then 429. In memory only; the request itself is idempotent, so this only stops
// a script from hammering the endpoint.
@Component
public class PremiumInterestLimiter {

    private final int max;
    private final long windowMillis;
    private final LongSupplier clock;
    private final ConcurrentHashMap<Long, Deque<Long>> calls = new ConcurrentHashMap<>();

    @Autowired
    public PremiumInterestLimiter(@Value("${app.rate-limit.premium-interest.max:10}") int max,
                                  @Value("${app.rate-limit.premium-interest.window-seconds:60}") long windowSeconds) {
        this(max, windowSeconds * 1000, System::currentTimeMillis);
    }

    PremiumInterestLimiter(int max, long windowMillis, LongSupplier clock) {
        this.max = max;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    public void acquire(long userId) {
        long now = clock.getAsLong();
        Deque<Long> times = calls.computeIfAbsent(userId, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && now - times.peekFirst() >= windowMillis) times.pollFirst();
            if (times.size() >= max) throw new TooManyRequestsException("Too many requests. Please try again in a minute.");
            times.addLast(now);
        }
    }
}
