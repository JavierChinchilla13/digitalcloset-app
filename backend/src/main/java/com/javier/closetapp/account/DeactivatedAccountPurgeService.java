package com.javier.closetapp.account;

import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.exception.InvalidInputException;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

// Audit H12: erases ordinary accounts that an admin deactivated and that have stayed deactivated for at least MIN_DAYS (30). It is run
// only by the owner, through scripts/purge-deactivated.sh -> the admin endpoint; nothing schedules it. Admins are never purged. Each
// account goes through the same erasure as "delete my account" (AccountErasureService), one at a time, so one failure cannot undo
// the others. The default is a dry run: it reports who WOULD be erased and erases nobody.
@Service
public class DeactivatedAccountPurgeService {

    // The retention the Privacy Policy states; asking for less is refused so a typo cannot erase accounts early.
    public static final int MIN_DAYS = 30;

    // `eligibleIds` are the accounts at or past the age; `erased` is how many were actually erased (0 in a dry run).
    public record Result(int days, boolean dryRun, List<Long> eligibleIds, int erased) { }

    private final UserRepository userRepository;
    private final AccountErasureService erasureService;

    public DeactivatedAccountPurgeService(UserRepository userRepository, AccountErasureService erasureService) {
        this.userRepository = userRepository;
        this.erasureService = erasureService;
    }

    public Result purge(int days, boolean dryRun) {
        if (days < MIN_DAYS) {
            throw new InvalidInputException("days must be at least " + MIN_DAYS);
        }
        LocalDateTime cutoff = LocalDateTime.now(ZoneOffset.UTC).minusDays(days);
        List<User> due = userRepository.findByActiveFalseAndRoleAndDeactivatedAtLessThanEqual(Role.ROLE_USER, cutoff);
        List<Long> ids = due.stream().map(User::getUserId).toList();
        int erased = 0;
        if (!dryRun) {
            for (User user : due) {
                erasureService.erase(user);
                erased++;
            }
        }
        return new Result(days, dryRun, ids, erased);
    }
}
