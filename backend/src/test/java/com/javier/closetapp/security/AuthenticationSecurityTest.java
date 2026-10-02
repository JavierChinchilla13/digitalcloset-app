package com.javier.closetapp.security;

import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Blueprint Phase 5, area 1 ("Registration role escalation test") plus the
// HTTP side of area 2: what the running filter chain does with good, bad and
// missing credentials.
class AuthenticationSecurityTest extends IntegrationTestBase {

    @Autowired private UserRepository userRepository;

    // ---- registration / role escalation (Task 5) ----

    @Test
    @DisplayName("registering always creates a normal user")
    void registrationCreatesNormalUser() throws Exception {
        TestUser user = registerUser();

        User saved = userRepository.findByEmail(user.email()).orElseThrow();
        assertEquals(Role.ROLE_USER, saved.getRole());
    }

    @Test
    @DisplayName("a role smuggled into the register request is ignored")
    void registrationIgnoresRequestedRole() throws Exception {
        String email = uniqueEmail();

        String token = objectMapper.readTree(
                mockMvc.perform(post("/api/auth/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json(Map.of(
                                        "email", email,
                                        "password", PASSWORD,
                                        "role", "ROLE_ADMIN",
                                        "roles", new String[]{"ROLE_ADMIN"},
                                        "admin", true))))
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString()).get("token").asText();

        assertEquals(Role.ROLE_USER, userRepository.findByEmail(email).orElseThrow().getRole());
        // ...and the token it got really is not an admin's.
        mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("the password is stored hashed, never as plain text")
    void passwordIsHashed() throws Exception {
        TestUser user = registerUser();

        String stored = userRepository.findByEmail(user.email()).orElseThrow().getPassword();
        assertNotEquals(PASSWORD, stored);
        assertTrue(stored.startsWith("$2"), "expected a BCrypt hash but got: " + stored.substring(0, 4) + "...");
    }

    @Test
    @DisplayName("registering the same email twice is rejected")
    void duplicateEmailIsRejected() throws Exception {
        TestUser user = registerUser();

        int code = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", user.email(), "password", PASSWORD))))
                .andReturn().getResponse().getStatus();

        assertTrue(code >= 400 && code < 600, "duplicate registration must not succeed, got " + code);
    }

    @Test
    @DisplayName("register validates email format and password length")
    void registrationIsValidated() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "not-an-email", "password", PASSWORD))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", uniqueEmail(), "password", "short"))))
                .andExpect(status().isBadRequest());
    }

    // ---- login ----

    @Test
    @DisplayName("login with the right password returns a usable token")
    void loginSucceeds() throws Exception {
        TestUser user = registerUser();

        String token = objectMapper.readTree(login(user.email(), PASSWORD)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("login with a wrong password or unknown email is 401")
    void loginFailsWithBadCredentials() throws Exception {
        TestUser user = registerUser();

        login(user.email(), "wrong-password").andExpect(status().isUnauthorized());
        login(uniqueEmail(), PASSWORD).andExpect(status().isUnauthorized());
    }

    // ---- tokens presented to the API ----

    @Test
    @DisplayName("a garbage bearer token does not get in")
    void garbageTokenIsRejected() throws Exception {
        int code = mockMvc.perform(get("/api/clothing").header("Authorization", "Bearer not-a-real-token"))
                .andReturn().getResponse().getStatus();

        assertTrue(code == 401 || code == 403, "expected 401/403 for a garbage token but got " + code);
    }

    @Test
    @DisplayName("a token signed with the wrong secret does not get in")
    void foreignSignedTokenIsRejected() throws Exception {
        // Header {"alg":"HS256"} / payload {"sub":"x@example.com"} with an arbitrary signature.
        String forged = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4QGV4YW1wbGUuY29tIn0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

        int code = mockMvc.perform(get("/api/clothing").header("Authorization", "Bearer " + forged))
                .andReturn().getResponse().getStatus();

        assertTrue(code == 401 || code == 403, "expected 401/403 for a forged token but got " + code);
    }

    @Test
    @DisplayName("a deactivated user's login is refused")
    void deactivatedUserCannotLogIn() throws Exception {
        TestUser user = registerUser();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/users/me/deactivate").header("Authorization", user.bearer()))
                .andExpect(status().is2xxSuccessful());

        int code = login(user.email(), PASSWORD).andReturn().getResponse().getStatus();

        assertTrue(code == 401 || code == 403, "deactivated account must not log in, got " + code);
    }
}
