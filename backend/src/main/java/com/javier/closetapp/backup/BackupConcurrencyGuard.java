package com.javier.closetapp.backup;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

// One backup at a time, server-wide: building one reads the whole database, so a second one is refused (429) instead of queued.
@Component
public class BackupConcurrencyGuard {

    private final AtomicBoolean busy = new AtomicBoolean(false);

    public boolean tryEnter() {
        return busy.compareAndSet(false, true);
    }

    public void leave() {
        busy.set(false);
    }
}
