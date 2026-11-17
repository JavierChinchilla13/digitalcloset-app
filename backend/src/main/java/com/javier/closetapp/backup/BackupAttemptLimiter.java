package com.javier.closetapp.backup;

import com.javier.closetapp.exception.TooManyRequestsException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

// At most `perHour` (3) and `perDay` (10) backup ATTEMPTS per admin account. Every attempt that gets as far as the password check
// counts, whether the password was right or wrong, so guessing the admin's password through this endpoint is capped too. In memory
// only (a restart resets it; the database count of finished downloads in BackupService covers that case).
@Component
public class BackupAttemptLimiter {

    private static final long HOUR = 3_600_000L;
    private static final long DAY = 24 * HOUR;

    private final int perHour;
    private final int perDay;
    private final LongSupplier clock;
    private final ConcurrentHashMap<Long, Deque<Long>> attempts = new ConcurrentHashMap<>();

    @Autowired
    public BackupAttemptLimiter(@Value("${app.backup.max-per-hour:3}") int perHour, @Value("${app.backup.max-per-day:10}") int perDay) {
        this(perHour, perDay, System::currentTimeMillis);
    }

    BackupAttemptLimiter(int perHour, int perDay, LongSupplier clock) {
        this.perHour = perHour;
        this.perDay = perDay;
        this.clock = clock;
    }

    // Counts this attempt, or refuses it (429) when the admin has used up the hour or the day.
    public void acquire(long adminUserId) {
        long now = clock.getAsLong();
        Deque<Long> times = attempts.computeIfAbsent(adminUserId, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && now - times.peekFirst() >= DAY) times.pollFirst();
            long inLastHour = times.stream().filter(t -> now - t < HOUR).count();
            if (inLastHour >= perHour || times.size() >= perDay) {
                throw new TooManyRequestsException("Too many backup attempts. Please try again later.");
            }
            times.addLast(now);
        }
    }
}
