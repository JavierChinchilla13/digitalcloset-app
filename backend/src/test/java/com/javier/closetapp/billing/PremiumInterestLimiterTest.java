package com.javier.closetapp.billing;

import com.javier.closetapp.exception.TooManyRequestsException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PremiumInterestLimiterTest {

    @Test
    @DisplayName("allows `max` calls in the window, then refuses until the window has passed; each account has its own allowance")
    void window() {
        AtomicLong now = new AtomicLong(1_000_000L);
        PremiumInterestLimiter limiter = new PremiumInterestLimiter(3, 60_000, now::get);
        for (int i = 0; i < 3; i++) limiter.acquire(7);
        assertThrows(TooManyRequestsException.class, () -> limiter.acquire(7));
        assertDoesNotThrow(() -> limiter.acquire(8));
        now.addAndGet(61_000);
        assertDoesNotThrow(() -> limiter.acquire(7));
    }
}
