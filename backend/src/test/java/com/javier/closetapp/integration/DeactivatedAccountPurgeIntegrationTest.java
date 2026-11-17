package com.javier.closetapp.integration;

import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit H12: accounts an admin deactivated are erased by the owner's purge once they have been deactivated for 30 days. Dry run by
// default; admins and active accounts are never touched; asking for less than 30 days is refused.
class DeactivatedAccountPurgeIntegrationTest extends IntegrationTestBase {

    private TestUser admin() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        return admin;
    }

    // Pretends the account was deactivated `days` ago.
    private void backdate(TestUser user, int days) {
        User entity = userRepository.findByEmail(user.email()).orElseThrow();
        entity.setDeactivatedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(days));
        userRepository.save(entity);
    }

    private org.springframework.test.web.servlet.ResultActions purge(TestUser caller, String query) throws Exception {
        return mockMvc.perform(post("/api/users/purge-deactivated" + query).header("Authorization", caller.bearer()));
    }

    @Test
    @DisplayName("deactivating records the time; reactivating clears it")
    void deactivationIsTimed() throws Exception {
        TestUser admin = admin();
        TestUser target = registerUser();

        mockMvc.perform(patch("/api/users/" + target.userId() + "/deactivate").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());
        assertNotNull(userRepository.findByEmail(target.email()).orElseThrow().getDeactivatedAt());

        mockMvc.perform(patch("/api/users/" + target.userId() + "/reactivate").header("Authorization", admin.bearer()))
                .andExpect(status().isOk());
        assertNull(userRepository.findByEmail(target.email()).orElseThrow().getDeactivatedAt());
    }

    @Test
    @DisplayName("a dry run (the default) lists who would be erased and erases nobody")
    void dryRunErasesNobody() throws Exception {
        TestUser admin = admin();
        TestUser old = registerUser();
        deactivateAsAdmin(old);
        backdate(old, 45);

        purge(admin, "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(true))
                .andExpect(jsonPath("$.erased").value(0))
                .andExpect(jsonPath("$.eligibleIds[?(@ == " + old.userId() + ")]").exists());
        assertTrue(userRepository.findByEmail(old.email()).isPresent());
    }

    @Test
    @DisplayName("with dryRun=false it erases accounts deactivated 30+ days ago, with all their data, and no one else")
    void applyErasesOnlyTheOldOnes() throws Exception {
        TestUser admin = admin();
        TestUser old = registerUser();
        createItem(old, "old-shirt", "TOP");
        TestUser recent = registerUser();
        TestUser active = registerUser();
        deactivateAsAdmin(old);
        deactivateAsAdmin(recent);
        backdate(old, 31);
        backdate(recent, 29);

        purge(admin, "?dryRun=false")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(false))
                .andExpect(jsonPath("$.eligibleIds[?(@ == " + old.userId() + ")]").exists())
                .andExpect(jsonPath("$.eligibleIds[?(@ == " + recent.userId() + ")]").doesNotExist());

        assertTrue(userRepository.findByEmail(old.email()).isEmpty());
        assertTrue(userRepository.findByEmail(recent.email()).isPresent());
        assertTrue(userRepository.findByEmail(active.email()).isPresent());
        assertTrue(userRepository.findByEmail(admin.email()).isPresent());
    }

    @Test
    @DisplayName("an admin account is never purged, even if somehow inactive for a long time")
    void adminsAreNeverPurged() throws Exception {
        TestUser caller = admin();
        TestUser otherAdmin = admin();
        User entity = userRepository.findByEmail(otherAdmin.email()).orElseThrow();
        entity.setActive(false);
        entity.setDeactivatedAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(400));
        userRepository.save(entity);

        purge(caller, "?dryRun=false").andExpect(status().isOk());

        assertTrue(userRepository.findByEmail(otherAdmin.email()).isPresent());
    }

    @Test
    @DisplayName("asking for less than 30 days is refused, and only admins can call it")
    void guards() throws Exception {
        TestUser admin = admin();
        TestUser ordinary = registerUser();
        TestUser victim = registerUser();
        deactivateAsAdmin(victim);
        backdate(victim, 5);

        purge(admin, "?days=7&dryRun=false").andExpect(status().isBadRequest());
        purge(ordinary, "").andExpect(status().isForbidden());
        mockMvc.perform(post("/api/users/purge-deactivated")).andExpect(status().is4xxClientError());

        assertFalse(userRepository.findByEmail(victim.email()).isEmpty());
    }
}
