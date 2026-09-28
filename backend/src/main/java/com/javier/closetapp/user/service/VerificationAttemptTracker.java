package com.javier.closetapp.user.service;

import com.javier.closetapp.user.entity.PendingAccountChange;
import com.javier.closetapp.user.repository.PendingAccountChangeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

// Records a wrong verification-code attempt in its own transaction (Task 79
// follow-up). Separated out of UserService specifically for this: confirm*()
// is @Transactional and throws InvalidVerificationCodeException on a wrong
// code, and Spring rolls back the *whole* method on any RuntimeException - so
// the attempt-count increment (and the lockout delete once it's maxed out)
// would be undone right along with it if done inline. REQUIRES_NEW commits
// this bookkeeping regardless of what the caller's transaction does next.
// (Only works via the Spring proxy, i.e. called from a different bean - a
// same-class private-method call would silently skip the proxy and this
// annotation would do nothing, which is the whole reason this is its own
// small service rather than a method on UserService.)
@Service
public class VerificationAttemptTracker {

    private final PendingAccountChangeRepository pendingChangeRepository;

    public VerificationAttemptTracker(PendingAccountChangeRepository pendingChangeRepository) {
        this.pendingChangeRepository = pendingChangeRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordWrongAttempt(Long changeId, int maxAttempts) {
        pendingChangeRepository.findById(changeId).ifPresent(change -> {
            change.setAttemptCount(change.getAttemptCount() + 1);
            if (change.getAttemptCount() >= maxAttempts) {
                pendingChangeRepository.delete(change);
            } else {
                pendingChangeRepository.save(change);
            }
        });
    }
}
