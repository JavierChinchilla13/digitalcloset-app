package com.javier.closetapp.backup;

import com.javier.closetapp.exception.TooManyRequestsException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BackupAttemptLimiterTest {

    private static final long MINUTE = 60_000L;
    private static final long HOUR = 60 * MINUTE;

    @Test
    @DisplayName("3 per hour: the fourth attempt within the hour is refused, and allowed again once the hour has passed")
    void perHour() {
        AtomicLong now = new AtomicLong(1_000_000_000L);
        BackupAttemptLimiter limiter = new BackupAttemptLimiter(3, 10, now::get);
        for (int i = 0; i < 3; i++) {
            limiter.acquire(1);
            now.addAndGet(5 * MINUTE);
        }
        assertThrows(TooManyRequestsException.class, () -> limiter.acquire(1));
        now.addAndGet(46 * MINUTE);      // the first attempt is now more than an hour old
        assertDoesNotThrow(() -> limiter.acquire(1));
    }

    @Test
    @DisplayName("10 per day: spaced out so the hourly limit never trips, the eleventh in 24 hours is refused")
    void perDay() {
        AtomicLong now = new AtomicLong(1_000_000_000L);
        BackupAttemptLimiter limiter = new BackupAttemptLimiter(3, 10, now::get);
        for (int i = 0; i < 10; i++) {
            limiter.acquire(1);
            now.addAndGet(2 * HOUR);      // 10 attempts over 20 hours
        }
        assertThrows(TooManyRequestsException.class, () -> limiter.acquire(1));    // 20 h after the first: still inside the day
        now.addAndGet(5 * HOUR);          // the first attempts fall out of the 24 hours
        assertDoesNotThrow(() -> limiter.acquire(1));
    }

    @Test
    @DisplayName("each admin has their own allowance")
    void perAdmin() {
        AtomicLong now = new AtomicLong(1_000_000_000L);
        BackupAttemptLimiter limiter = new BackupAttemptLimiter(3, 10, now::get);
        for (int i = 0; i < 3; i++) limiter.acquire(1);
        assertThrows(TooManyRequestsException.class, () -> limiter.acquire(1));
        assertDoesNotThrow(() -> limiter.acquire(2));
    }
}
