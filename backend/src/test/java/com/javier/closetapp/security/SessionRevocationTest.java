package com.javier.closetapp.security;

import com.jayway.jsonpath.JsonPath;
import com.javier.closetapp.auth.mail.PasswordResetMailer;
import com.javier.closetapp.auth.mail.VerificationCodeMailer;
import com.javier.closetapp.support.FakeGoogleTokenVerifier;
import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit H1: a token must stop working the moment its account is deactivated, not 24 h later, and
// must not come back to life when the account is reactivated.
class SessionRevocationTest extends IntegrationTestBase {

    // Replace the real mailers so the tests can read the reset link and the confirmation code.
    @MockBean private PasswordResetMailer resetMailer;
    @MockBean private VerificationCodeMailer codeMailer;

    private void assertSignedIn(String bearer) throws Exception {
        mockMvc.perform(get("/api/clothing").header("Authorization", bearer)).andExpect(status().isOk());
    }

    private void assertSignedOut(String bearer) throws Exception {
        mockMvc.perform(get("/api/clothing").header("Authorization", bearer)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a user who deletes their own account is signed out everywhere at once")
    void deletionEndsTheSession() throws Exception {
        TestUser user = registerUser();
        mockMvc.perform(get("/api/clothing").header("Authorization", user.bearer())).andExpect(status().isOk());

        deleteOwnAccount(user);

        mockMvc.perform(get("/api/clothing").header("Authorization", user.bearer()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("an admin deactivating a user ends that user's session at once")
    void adminDeactivationEndsTheSession() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        TestUser victim = registerUser();

        mockMvc.perform(patch("/api/users/" + victim.userId() + "/deactivate").header("Authorization", admin.bearer()))
                .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/clothing").header("Authorization", victim.bearer()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("reactivating an account does not bring its old tokens back to life")
    void reactivationDoesNotResurrectOldTokens() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        TestUser user = registerUser();
        mockMvc.perform(patch("/api/users/" + user.userId() + "/deactivate").header("Authorization", admin.bearer()))
                .andExpect(status().is2xxSuccessful());
        mockMvc.perform(patch("/api/users/" + user.userId() + "/reactivate").header("Authorization", admin.bearer()))
                .andExpect(status().is2xxSuccessful());

        assertSignedOut(user.bearer());
        // The person can sign in again and gets a working token.
        String token = JsonPath.read(login(user.email(), PASSWORD).andReturn().getResponse().getContentAsString(), "$.token");
        assertSignedIn("Bearer " + token);
    }

    @Test
    @DisplayName("resetting the password signs out every token made before it")
    void passwordResetEndsOldSessions() throws Exception {
        TestUser user = registerUser();
        mockMvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", user.email()))))
                .andExpect(status().is2xxSuccessful());
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(resetMailer).sendPasswordResetLink(eq(user.email()), link.capture());
        String rawToken = link.getValue().substring(link.getValue().indexOf("token=") + "token=".length());

        mockMvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", rawToken, "password", "Brand-New-Pass-123"))))
                .andExpect(status().is2xxSuccessful());

        assertSignedOut(user.bearer());
        String token = JsonPath.read(login(user.email(), "Brand-New-Pass-123").andReturn().getResponse().getContentAsString(), "$.token");
        assertSignedIn("Bearer " + token);
    }

    @Test
    @DisplayName("changing the password signs other sessions out and hands the caller a fresh token")
    void passwordChangeEndsOtherSessions() throws Exception {
        TestUser user = registerUser();
        mockMvc.perform(post("/api/users/me/password/request").header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "Brand-New-Pass-123"))))
                .andExpect(status().isNoContent());
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(codeMailer).sendPasswordChangeCode(eq(user.email()), code.capture());

        String body = mockMvc.perform(post("/api/users/me/password/confirm").header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("code", code.getValue()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String fresh = JsonPath.read(body, "$.token");

        assertSignedOut(user.bearer());
        assertSignedIn("Bearer " + fresh);
    }

    @Test
    @DisplayName("linking an existing password account to Google signs out whoever held the old password")
    void googleLinkingEndsOldSessions() throws Exception {
        TestUser user = registerUser();
        assertSignedIn(user.bearer());

        String credential = FakeGoogleTokenVerifier.credential("sub-" + user.userId(), user.email(), true, "A", "B");
        String body = mockMvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("credential", credential))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertSignedOut(user.bearer());
        assertEquals(user.userId(), ((Number) JsonPath.read(body, "$.userId")).longValue());
        assertSignedIn("Bearer " + JsonPath.<String>read(body, "$.token"));
    }
}
