package com.javier.closetapp.integration;

import com.javier.closetapp.auth.mail.VerificationCodeMailer;
import com.javier.closetapp.common.enums.AccountChangeType;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.PendingAccountChange;
import com.javier.closetapp.user.repository.PendingAccountChangeRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;

import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 79 (+ its code-confirmation follow-up): account settings - email
// uniqueness, code-confirmed password/email changes, admin create-user.
class SettingsIntegrationTest extends IntegrationTestBase {

    // Replaces the real (dev-logging) mailer so tests can capture the code
    // that would otherwise only ever exist in the outgoing email.
    @MockBean
    private VerificationCodeMailer mailer;

    @Autowired
    private PendingAccountChangeRepository pendingChangeRepository;

    private String capturePasswordCode(TestUser user) {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendPasswordChangeCode(eq(user.email()), captor.capture());
        return captor.getValue();
    }

    private String captureEmailCode(TestUser user) {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendEmailChangeCode(eq(user.email()), captor.capture());
        return captor.getValue();
    }

    // ---- registration: email uniqueness + first/last name ----

    @Test
    @DisplayName("registering with a taken email is 409 with a clear message, and the original account is untouched")
    void registerRejectsDuplicateEmail() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", alice.email(), "password", PASSWORD))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An account with this email already exists"));

        // The original account can still log in - nothing about it was disturbed.
        login(alice.email(), PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("registering persists first and last name (previously silently dropped)")
    void registerPersistsName() throws Exception {
        String email = uniqueEmail();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email, "password", PASSWORD,
                                "firstName", "Ada", "lastName", "Lovelace"))))
                .andExpect(status().isOk());

        String token = objectMapper.readTree(login(email, PASSWORD)
                        .andReturn().getResponse().getContentAsString())
                .get("token").asText();
        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.firstName").value("Ada"))
                .andExpect(jsonPath("$.lastName").value("Lovelace"));
    }

    // ---- change password (request -> emailed code -> confirm) ----

    @Test
    @DisplayName("request stages the change but does not apply it; confirm with the right code applies it")
    void changePasswordRequestThenConfirmSucceeds() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "New-Password-123"))))
                .andExpect(status().isNoContent());
        String code = capturePasswordCode(alice);
        // Not applied yet - the old password still works, the new one doesn't.
        login(alice.email(), PASSWORD).andExpect(status().isOk());
        login(alice.email(), "New-Password-123").andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/users/me/password/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", code))))
                .andExpect(status().isNoContent());

        login(alice.email(), "New-Password-123").andExpect(status().isOk());
        login(alice.email(), PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("confirming with the wrong code is rejected and nothing changes")
    void changePasswordConfirmRejectsWrongCode() throws Exception {
        TestUser alice = registerUser();
        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "New-Password-123"))));

        mockMvc.perform(post("/api/users/me/password/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", "000000"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This code is invalid or has expired."));

        login(alice.email(), PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("confirming with no prior request fails")
    void changePasswordConfirmWithoutRequestFails() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/users/me/password/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", "123456"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("an expired code is rejected even if it's the right one")
    void changePasswordConfirmRejectsExpiredCode() throws Exception {
        TestUser alice = registerUser();
        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "New-Password-123"))));
        String code = capturePasswordCode(alice);
        backdateExpiry(alice, AccountChangeType.PASSWORD);

        mockMvc.perform(post("/api/users/me/password/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", code))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("after enough wrong attempts, even the right code no longer works - a fresh request is required")
    void changePasswordConfirmLocksOutAfterMaxAttempts() throws Exception {
        TestUser alice = registerUser();
        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "New-Password-123"))));
        String code = capturePasswordCode(alice);

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/users/me/password/confirm")
                            .header("Authorization", alice.bearer())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("code", "000000"))))
                    .andExpect(status().isBadRequest());
        }

        // The 6th attempt - even with the actually-correct code - is refused.
        mockMvc.perform(post("/api/users/me/password/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", code))))
                .andExpect(status().isBadRequest());

        login(alice.email(), PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("requesting again invalidates the previous code")
    void changePasswordSecondRequestInvalidatesFirstCode() throws Exception {
        TestUser alice = registerUser();
        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "New-Password-123"))));
        String firstCode = capturePasswordCode(alice);
        // Clear the min-interval guard so the second request isn't itself rejected.
        backdateCreatedAt(alice, AccountChangeType.PASSWORD);

        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "Yet-Another-456"))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/users/me/password/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", firstCode))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("requesting again too soon is rejected (the resend abuse guard)")
    void changePasswordSecondRequestTooSoonIsRejected() throws Exception {
        TestUser alice = registerUser();
        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "New-Password-123"))));

        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "Yet-Another-456"))))
                .andExpect(status().is(429));
    }

    @Test
    @DisplayName("requesting with the wrong current password is 403, and no code is sent")
    void changePasswordRequestRejectsWrongCurrent() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", "totally-wrong", "newPassword", "New-Password-123"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));

        verify(mailer, org.mockito.Mockito.never()).sendPasswordChangeCode(anyString(), anyString());
        login(alice.email(), PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("a new password shorter than 8 characters is rejected at the request step")
    void changePasswordRequestValidatesLength() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "short"))))
                .andExpect(status().isBadRequest());
    }

    // ---- change email (request -> emailed code -> confirm) ----

    @Test
    @DisplayName("request stages the change but does not apply it; confirm gives a fresh token and the old one dies")
    void changeEmailRequestThenConfirmSucceeds() throws Exception {
        TestUser alice = registerUser();
        String newEmail = uniqueEmail();

        mockMvc.perform(post("/api/users/me/email/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("newEmail", newEmail, "currentPassword", PASSWORD))))
                .andExpect(status().isNoContent());
        String code = captureEmailCode(alice);
        // Not applied yet - old token still resolves to the old email.
        mockMvc.perform(get("/api/users/me").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(alice.email()));

        String body = mockMvc.perform(post("/api/users/me/email/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", code))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(newEmail))
                .andReturn().getResponse().getContentAsString();
        String newToken = objectMapper.readTree(body).get("token").asText();

        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + newToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(newEmail));

        // The old token's subject (the old email) no longer resolves to anyone.
        int code2 = mockMvc.perform(get("/api/users/me").header("Authorization", alice.bearer()))
                .andReturn().getResponse().getStatus();
        assertTrue(code2 == 401 || code2 == 403, "old token should be rejected, got " + code2);

        login(newEmail, PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("confirming email change with the wrong code is rejected and nothing changes")
    void changeEmailConfirmRejectsWrongCode() throws Exception {
        TestUser alice = registerUser();
        mockMvc.perform(post("/api/users/me/email/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("newEmail", uniqueEmail(), "currentPassword", PASSWORD))));

        mockMvc.perform(post("/api/users/me/email/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", "000000"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/users/me").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$.email").value(alice.email()));
    }

    @Test
    @DisplayName("requesting email change to one already in use is 409, and no code is sent")
    void changeEmailRequestRejectsDuplicate() throws Exception {
        TestUser alice = registerUser();
        TestUser bob = registerUser();

        mockMvc.perform(post("/api/users/me/email/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("newEmail", bob.email(), "currentPassword", PASSWORD))))
                .andExpect(status().isConflict());

        verify(mailer, org.mockito.Mockito.never()).sendEmailChangeCode(anyString(), anyString());
        login(alice.email(), PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("requesting your own current email is a harmless no-op that still requires the code")
    void changeEmailToSameEmailStillRequiresConfirm() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/users/me/email/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("newEmail", alice.email(), "currentPassword", PASSWORD))))
                .andExpect(status().isNoContent());
        String code = captureEmailCode(alice);

        mockMvc.perform(post("/api/users/me/email/confirm")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", code))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(alice.email()));
    }

    @Test
    @DisplayName("requesting email change with the wrong current password is 403 and nothing is staged")
    void changeEmailRequestRejectsWrongPassword() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/users/me/email/request")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("newEmail", uniqueEmail(), "currentPassword", "wrong"))))
                .andExpect(status().isForbidden());

        login(alice.email(), PASSWORD).andExpect(status().isOk());
    }

    private void backdateExpiry(TestUser user, AccountChangeType type) {
        PendingAccountChange change = pendingChangeRepository
                .findFirstByUser_UserIdAndChangeTypeOrderByCreatedAtDesc(user.userId(), type).orElseThrow();
        change.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        pendingChangeRepository.save(change);
    }

    private void backdateCreatedAt(TestUser user, AccountChangeType type) {
        PendingAccountChange change = pendingChangeRepository
                .findFirstByUser_UserIdAndChangeTypeOrderByCreatedAtDesc(user.userId(), type).orElseThrow();
        change.setCreatedAt(LocalDateTime.now().minusMinutes(5));
        pendingChangeRepository.save(change);
    }

    // ---- admin create-user ----

    @Test
    @DisplayName("an admin can create a normal user and an admin, each with the requested role")
    void adminCanCreateUsersOfBothRoles() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);

        String userEmail = uniqueEmail();
        mockMvc.perform(post("/api/users")
                        .header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", userEmail, "password", PASSWORD,
                                "firstName", "New", "lastName", "User", "role", "ROLE_USER"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("ROLE_USER"))
                .andExpect(jsonPath("$.email").value(userEmail));
        login(userEmail, PASSWORD).andExpect(status().isOk());

        String adminEmail = uniqueEmail();
        mockMvc.perform(post("/api/users")
                        .header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", adminEmail, "password", PASSWORD, "role", "ROLE_ADMIN"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("ROLE_ADMIN"));

        // The freshly-created admin really can use admin endpoints.
        String newAdminToken = objectMapper.readTree(login(adminEmail, PASSWORD)
                        .andReturn().getResponse().getContentAsString())
                .get("token").asText();
        mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + newAdminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("a normal user cannot create users at all")
    void nonAdminCannotCreateUsers() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(post("/api/users")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", uniqueEmail(), "password", PASSWORD, "role", "ROLE_USER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("admin create-user with a taken email is 409")
    void adminCreateUserRejectsDuplicateEmail() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        TestUser existing = registerUser();

        mockMvc.perform(post("/api/users")
                        .header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", existing.email(), "password", PASSWORD, "role", "ROLE_USER"))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("admin create-user requires a role")
    void adminCreateUserRequiresRole() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);

        mockMvc.perform(post("/api/users")
                        .header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", uniqueEmail(), "password", PASSWORD))))
                .andExpect(status().isBadRequest());
    }
}
