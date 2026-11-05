package com.javier.closetapp.security;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit H1: a token must stop working the moment its account is deactivated, not 24 h later, and
// must not come back to life when the account is reactivated.
class SessionRevocationTest extends IntegrationTestBase {

    @Test
    @DisplayName("a user who deactivates their own account is signed out everywhere at once")
    void selfDeactivationEndsTheSession() throws Exception {
        TestUser user = registerUser();
        mockMvc.perform(get("/api/clothing").header("Authorization", user.bearer())).andExpect(status().isOk());

        mockMvc.perform(patch("/api/users/me/deactivate").header("Authorization", user.bearer()))
                .andExpect(status().is2xxSuccessful());

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
}
