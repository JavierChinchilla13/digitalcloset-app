package com.javier.closetapp.user.service;

import com.javier.closetapp.auth.dto.AuthResponse;
import com.javier.closetapp.auth.mail.VerificationCodeMailer;
import com.javier.closetapp.common.enums.AccountChangeType;
import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.exception.DuplicateEmailException;
import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.exception.InvalidVerificationCodeException;
import com.javier.closetapp.exception.ResourceNotFoundException;
import com.javier.closetapp.exception.TooManyRequestsException;
import com.javier.closetapp.outfit.entity.Outfit;
import com.javier.closetapp.outfit.repository.OutfitRepository;
import com.javier.closetapp.security.JwtService;
import com.javier.closetapp.user.dto.AdminCreateUserRequest;
import com.javier.closetapp.user.dto.ChangeEmailRequest;
import com.javier.closetapp.user.dto.ChangePasswordRequest;
import com.javier.closetapp.user.dto.ConfirmCodeRequest;
import com.javier.closetapp.user.dto.UserResponse;
import com.javier.closetapp.user.dto.UserUpdateRequest;
import com.javier.closetapp.user.entity.PendingAccountChange;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.PendingAccountChangeRepository;
import com.javier.closetapp.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class UserService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final OutfitRepository outfitRepository;
    private final PendingAccountChangeRepository pendingChangeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final VerificationCodeMailer verificationCodeMailer;
    private final VerificationAttemptTracker verificationAttemptTracker;
    private final PlanLimits planLimits;

    private final long verificationExpirationMinutes;
    private final long verificationMinIntervalSeconds;
    private final int verificationMaxAttempts;

    public UserService(UserRepository userRepository, OutfitRepository outfitRepository,
                        PendingAccountChangeRepository pendingChangeRepository,
                        PasswordEncoder passwordEncoder, JwtService jwtService,
                        VerificationCodeMailer verificationCodeMailer,
                        VerificationAttemptTracker verificationAttemptTracker,
                        PlanLimits planLimits,
                        @Value("${app.account-verification.expiration-minutes:10}") long verificationExpirationMinutes,
                        @Value("${app.account-verification.min-interval-seconds:60}") long verificationMinIntervalSeconds,
                        @Value("${app.account-verification.max-attempts:5}") int verificationMaxAttempts) {
        this.userRepository = userRepository;
        this.verificationAttemptTracker = verificationAttemptTracker;
        this.planLimits = planLimits;
        this.outfitRepository = outfitRepository;
        this.pendingChangeRepository = pendingChangeRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.verificationCodeMailer = verificationCodeMailer;
        this.verificationExpirationMinutes = verificationExpirationMinutes;
        this.verificationMinIntervalSeconds = verificationMinIntervalSeconds;
        this.verificationMaxAttempts = verificationMaxAttempts;
    }

    public User getAuthenticatedUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    public UserResponse getCurrentUserResponse() {
        return mapToResponse(getAuthenticatedUser());
    }

    @Transactional
    public UserResponse updateCurrentUser(UserUpdateRequest request) {
        User user = getAuthenticatedUser();
        
        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
        }
        
        User updatedUser = userRepository.save(user);
        return mapToResponse(updatedUser);
    }

    // Makes one of the caller's own outfits their main outfit (Task 78). Same
    // 404 / 403 split as the other outfit operations: unknown id vs someone
    // else's outfit.
    @Transactional
    public UserResponse setMainOutfit(Long outfitId) {
        User user = getAuthenticatedUser();
        Outfit outfit = outfitRepository.findById(outfitId)
                .orElseThrow(() -> new ResourceNotFoundException("Outfit not found"));

        if (!outfit.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to use this outfit");
        }

        user.setMainOutfitId(outfitId);
        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse clearMainOutfit() {
        User user = getAuthenticatedUser();
        user.setMainOutfitId(null);
        return mapToResponse(userRepository.save(user));
    }

    // ---- Settings (self-service): code-confirmed password change ----
    // "Request" fully validates and stages the change, then emails a 6-digit
    // code to the account's *current* (already-verified) address; "confirm"
    // applies it once that code comes back. This is the whole point of the
    // feature: a hijacked session alone (e.g. a stolen JWT) is no longer
    // enough to change the password - the real owner's inbox has to agree.
    @Transactional
    public void requestPasswordChange(ChangePasswordRequest request) {
        User user = getAuthenticatedUser();
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new ForbiddenOperationException("Current password is incorrect");
        }

        String code = stagePendingChange(user, AccountChangeType.PASSWORD, change ->
                change.setNewPasswordHash(passwordEncoder.encode(request.getNewPassword())));

        verificationCodeMailer.sendPasswordChangeCode(user.getEmail(), code);
    }

    @Transactional
    public void confirmPasswordChange(ConfirmCodeRequest request) {
        User user = getAuthenticatedUser();
        PendingAccountChange change = consumePendingChange(user, AccountChangeType.PASSWORD, request.getCode());

        user.setPassword(change.getNewPasswordHash());
        userRepository.save(user);
    }

    // ---- Settings (self-service): code-confirmed email change ----
    // Same shape as the password flow above. Email is the JWT subject (see
    // JwtAuthenticationFilter/UserDetailsService), so the caller's existing
    // token keeps working through both steps and only stops authenticating
    // once confirm actually saves the new email - at which point the caller
    // is given the fresh token this returns.
    @Transactional
    public void requestEmailChange(ChangeEmailRequest request) {
        User user = getAuthenticatedUser();
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new ForbiddenOperationException("Current password is incorrect");
        }
        // Excludes the caller: re-submitting their own current email is a
        // harmless no-op, not a false "already in use".
        userRepository.findByEmail(request.getNewEmail())
                .filter(existing -> !existing.getUserId().equals(user.getUserId()))
                .ifPresent(existing -> {
                    throw new DuplicateEmailException("An account with this email already exists");
                });

        String code = stagePendingChange(user, AccountChangeType.EMAIL, change ->
                change.setNewEmail(request.getNewEmail()));

        verificationCodeMailer.sendEmailChangeCode(user.getEmail(), code);
    }

    @Transactional
    public AuthResponse confirmEmailChange(ConfirmCodeRequest request) {
        User user = getAuthenticatedUser();
        PendingAccountChange change = consumePendingChange(user, AccountChangeType.EMAIL, request.getCode());

        user.setEmail(change.getNewEmail());
        User saved = userRepository.save(user);

        return new AuthResponse(jwtService.generateToken(saved), saved.getUserId(), saved.getEmail());
    }

    // ---- Shared pending-change plumbing ----

    // Invalidates any existing pending change of this type for the user (a
    // second request supersedes the first - same "delete then insert"
    // pattern PasswordResetService.requestReset already uses) and stores a
    // new one with a fresh code. Returns the raw code - the only place it
    // exists outside this call is the email it's about to be sent in; the
    // database only ever holds its hash.
    private String stagePendingChange(User user, AccountChangeType type, java.util.function.Consumer<PendingAccountChange> populate) {
        Optional<PendingAccountChange> latest = pendingChangeRepository
                .findFirstByUser_UserIdAndChangeTypeOrderByCreatedAtDesc(user.getUserId(), type);
        if (latest.isPresent() && latest.get().getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(verificationMinIntervalSeconds))) {
            throw new TooManyRequestsException("Please wait a moment before requesting another code");
        }

        pendingChangeRepository.deleteAllByUserIdAndChangeType(user.getUserId(), type);

        String code = generateCode();
        PendingAccountChange change = new PendingAccountChange(
                user, type, hash(code), LocalDateTime.now().plusMinutes(verificationExpirationMinutes));
        populate.accept(change);
        pendingChangeRepository.save(change);

        return code;
    }

    // Validates the code against the user's one live pending change of this
    // type and returns it for the caller to apply. A wrong code counts
    // against the attempt limit and is never distinguished from "no such
    // change" / "expired" / "already used" in the error - same one-message
    // philosophy as InvalidResetTokenException, so a guesser learns nothing.
    private PendingAccountChange consumePendingChange(User user, AccountChangeType type, String rawCode) {
        PendingAccountChange change = pendingChangeRepository
                .findFirstByUser_UserIdAndChangeTypeOrderByCreatedAtDesc(user.getUserId(), type)
                .orElseThrow(InvalidVerificationCodeException::new);

        if (change.getUsedAt() != null || change.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new InvalidVerificationCodeException();
        }

        if (!change.getCodeHash().equals(hash(rawCode == null ? "" : rawCode))) {
            // Recorded in its own transaction (see VerificationAttemptTracker) so
            // it survives this method's own transaction rolling back when the
            // exception below is thrown - otherwise the increment (and the
            // eventual lockout) would never actually persist.
            verificationAttemptTracker.recordWrongAttempt(change.getChangeId(), verificationMaxAttempts);
            throw new InvalidVerificationCodeException();
        }

        change.setUsedAt(LocalDateTime.now());
        pendingChangeRepository.save(change);
        return change;
    }

    private static String generateCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    private static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    // Admin-only: creates an account with an admin-chosen role. The
    // "only admins can create admins" rule is the endpoint's own
    // @PreAuthorize("hasRole('ADMIN')") - this method trusts the caller
    // exactly like deactivateUser/reactivateUser already do.
    @Transactional
    public UserResponse createUser(AdminCreateUserRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new DuplicateEmailException("An account with this email already exists");
        }

        User user = new User(request.getEmail(), passwordEncoder.encode(request.getPassword()), request.getRole());
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());

        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public void deactivateCurrentUser() {
        User user = getAuthenticatedUser();
        user.setActive(false);
        userRepository.save(user);
    }

    // Admin methods
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public UserResponse deactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setActive(false);
        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse reactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setActive(true);
        return mapToResponse(userRepository.save(user));
    }

    // Admin-only: gives an account the FREE or PREMIUM plan (no payment flow yet). A 404 for an unknown id.
    @Transactional
    public UserResponse setPlan(Long userId, Plan plan) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setPlan(plan);
        return mapToResponse(userRepository.save(user));
    }

    private UserResponse mapToResponse(User user) {
        return new UserResponse(
                user.getUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole(),
                user.isActive(),
                user.getCreatedAt(),
                user.getMainOutfitId(),
                user.getPlan(),
                planLimits.garmentLimit(user)
        );
    }
}
