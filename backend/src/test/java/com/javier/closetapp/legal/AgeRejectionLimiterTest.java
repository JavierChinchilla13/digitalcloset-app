package com.javier.closetapp.legal;

import com.javier.closetapp.exception.TooManyRequestsException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

// Audit H12: the counter of sign-ups refused for age (per client address, in memory). Off by default.
class AgeRejectionLimiterTest {

    private static final long HOUR = 3_600_000L;

    @Test
    @DisplayName("switched off (the default) it never blocks, however many refusals")
    void offNeverBlocks() {
        AgeRejectionLimiter limiter = new AgeRejectionLimiter(false, 2, HOUR, System::currentTimeMillis);
        for (int i = 0; i < 50; i++) {
            limiter.recordRejection("1.2.3.4");
            assertDoesNotThrow(() -> limiter.requireNotBlocked("1.2.3.4"));
        }
    }

    @Test
    @DisplayName("switched on, an address is blocked after the maximum number of refusals")
    void blocksAfterMax() {
        AgeRejectionLimiter limiter = new AgeRejectionLimiter(true, 3, HOUR, System::currentTimeMillis);
        for (int i = 0; i < 3; i++) {
            assertDoesNotThrow(() -> limiter.requireNotBlocked("1.2.3.4"));
            limiter.recordRejection("1.2.3.4");
        }
        assertThrows(TooManyRequestsException.class, () -> limiter.requireNotBlocked("1.2.3.4"));
    }

    @Test
    @DisplayName("another address is not affected")
    void addressesAreIndependent() {
        AgeRejectionLimiter limiter = new AgeRejectionLimiter(true, 1, HOUR, System::currentTimeMillis);
        limiter.recordRejection("1.2.3.4");

        assertThrows(TooManyRequestsException.class, () -> limiter.requireNotBlocked("1.2.3.4"));
        assertDoesNotThrow(() -> limiter.requireNotBlocked("5.6.7.8"));
    }

    @Test
    @DisplayName("the block ends when the window has passed")
    void windowExpires() {
        AtomicLong now = new AtomicLong(1_000_000L);
        AgeRejectionLimiter limiter = new AgeRejectionLimiter(true, 2, HOUR, now::get);
        limiter.recordRejection("1.2.3.4");
        limiter.recordRejection("1.2.3.4");
        assertThrows(TooManyRequestsException.class, () -> limiter.requireNotBlocked("1.2.3.4"));

        now.addAndGet(HOUR + 1);

        assertDoesNotThrow(() -> limiter.requireNotBlocked("1.2.3.4"));
    }
}
