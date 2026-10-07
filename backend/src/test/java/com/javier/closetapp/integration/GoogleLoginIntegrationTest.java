package com.javier.closetapp.integration;

import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.support.FakeGoogleTokenVerifier;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 98: POST /api/auth/google. The Google token check itself is faked here (see
// FakeGoogleTokenVerifier); what is tested is what the app does with a verified identity.
class GoogleLoginIntegrationTest extends IntegrationTestBase {

    private String sub() {
        return "sub-" + UUID.randomUUID();
    }

    private ResultActions google(String credential) throws Exception {
        return mockMvc.perform(post("/api/auth/google")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("credential", credential))));
    }

    private ResultActions google(String sub, String email) throws Exception {
        return google(FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace"));
    }

    private String tokenOf(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    @DisplayName("a first Google sign-in creates a normal FREE account with no password, from the Google profile")
    void createsAccount() throws Exception {
        String email = uniqueEmail();
        ResultActions result = google(sub(), email).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));

        User user = userRepository.findByEmail(email).orElseThrow();
        assertEquals(Role.ROLE_USER, user.getRole());
        assertEquals(Plan.FREE, user.getPlan());
        assertNull(user.getPassword());
        assertNotNull(user.getGoogleId());
        assertEquals("Ada", user.getFirstName());
        assertEquals("Lovelace", user.getLastName());

        // The app's own token works like any other.
        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + tokenOf(result)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.garmentLimit").value(15));
    }

    @Test
    @DisplayName("signing in again with the same Google account reuses the account")
    void secondSignInReusesAccount() throws Exception {
        String sub = sub();
        String email = uniqueEmail();
        long first = objectMapper.readTree(google(sub, email).andReturn().getResponse().getContentAsString()).get("userId").asLong();
        long second = objectMapper.readTree(google(sub, email).andReturn().getResponse().getContentAsString()).get("userId").asLong();

        assertEquals(first, second);
    }

    @Test
    @DisplayName("a password account with the same email is linked: Google works, the old password is cleared, garments stay")
    void linksExistingAccountAndClearsItsPassword() throws Exception {
        TestUser existing = registerUser();
        long itemId = createItem(existing, "my-shirt", "TOP");

        ResultActions result = google(sub(), existing.email()).andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(existing.userId()));

        User user = userRepository.findByEmail(existing.email()).orElseThrow();
        assertNotNull(user.getGoogleId());
        assertNull(user.getPassword());
        login(existing.email(), PASSWORD).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/clothing").header("Authorization", "Bearer " + tokenOf(result)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].itemId").value(itemId));
    }

    @Test
    @DisplayName("the email match ignores case (Google sends lower case, sign-up kept what was typed)")
    void emailMatchIgnoresCase() throws Exception {
        TestUser existing = registerUser();
        String shouted = existing.email().toUpperCase();

        google(sub(), shouted).andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(existing.userId()));
    }

    @Test
    @DisplayName("an unverified Google email is refused and creates nothing")
    void unverifiedEmail() throws Exception {
        String email = uniqueEmail();

        google(FakeGoogleTokenVerifier.credential(sub(), email, false, "A", "B"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Your Google email address is not verified."));
        assertEquals(false, userRepository.findByEmail(email).isPresent());
    }

    @Test
    @DisplayName("a bad token is a 401 with a message the page can show")
    void badToken() throws Exception {
        google("garbage").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Google sign-in failed. Please try again."));
    }

    @Test
    @DisplayName("a deactivated account cannot sign in with Google, and is not linked or changed")
    void deactivatedAccount() throws Exception {
        TestUser existing = registerUser();
        mockMvc.perform(patch("/api/users/me/deactivate").header("Authorization", existing.bearer())).andExpect(status().isNoContent());

        google(sub(), existing.email()).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("This account has been deactivated."));

        User user = userRepository.findByEmail(existing.email()).orElseThrow();
        assertNull(user.getGoogleId());
        assertNotNull(user.getPassword());
    }

    @Test
    @DisplayName("an already linked account that was deactivated is refused too")
    void deactivatedLinkedAccount() throws Exception {
        String sub = sub();
        String email = uniqueEmail();
        String token = tokenOf(google(sub, email));
        mockMvc.perform(patch("/api/users/me/deactivate").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());

        google(sub, email).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a blank credential is a 400")
    void blankCredential() throws Exception {
        mockMvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content("{\"credential\":\"\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("a Google-only account cannot password-login, and the password flows explain why")
    void googleOnlyAccountHasNoPassword() throws Exception {
        String email = uniqueEmail();
        String token = tokenOf(google(sub(), email));

        login(email, "anything-at-all-123").andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/users/me/password/request")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", "whatever-123", "newPassword", "Brand-New-Pw-1"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("signs in with Google")));

        mockMvc.perform(post("/api/users/me/email/request")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", "whatever-123", "newEmail", uniqueEmail()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("signs in with Google")));
    }

    @Test
    @DisplayName("Forgot password lets a Google-only user add a password")
    void forgotPasswordAddsAPassword() throws Exception {
        String email = uniqueEmail();
        google(sub(), email).andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON).content(json(Map.of("email", email))))
                .andExpect(status().isOk());
        // (the mail goes to the log mailer in tests; the reset itself is covered by the password reset tests)
        assertNotNull(userRepository.findByEmail(email).orElseThrow().getGoogleId());
    }
}
