package com.javier.closetapp.integration;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 78: the account's "main outfit" - which outfit the Showcase opens on and
// Attire edits. Stored on the user; only ever one of their own outfits.
class MainOutfitIntegrationTest extends IntegrationTestBase {

    private void assertMainOutfit(TestUser user, Long expected) throws Exception {
        var result = mockMvc.perform(get("/api/users/me").header("Authorization", user.bearer()))
                .andExpect(status().isOk());
        if (expected == null) {
            result.andExpect(jsonPath("$.mainOutfitId").value(nullValue()));
        } else {
            result.andExpect(jsonPath("$.mainOutfitId").value(expected));
        }
    }

    private void setMain(TestUser user, long outfitId, int expectedStatus) throws Exception {
        mockMvc.perform(put("/api/users/me/main-outfit")
                        .header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("outfitId", outfitId))))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    @DisplayName("a new user has no main outfit")
    void startsWithNone() throws Exception {
        assertMainOutfit(registerUser(), null);
    }

    @Test
    @DisplayName("the first outfit a user saves becomes their main outfit automatically")
    void firstOutfitBecomesMain() throws Exception {
        TestUser alice = registerUser();
        long item = createItem(alice, "shirt", "TOP");

        long first = createOutfit(alice, "first", item);

        assertMainOutfit(alice, first);
    }

    @Test
    @DisplayName("later outfits do not replace the main outfit")
    void laterOutfitsDoNotReplaceIt() throws Exception {
        TestUser alice = registerUser();
        long item = createItem(alice, "shirt", "TOP");
        long first = createOutfit(alice, "first", item);

        createOutfit(alice, "second", item);

        assertMainOutfit(alice, first);
    }

    @Test
    @DisplayName("the user can choose another of their own outfits as main")
    void canChangeMain() throws Exception {
        TestUser alice = registerUser();
        long item = createItem(alice, "shirt", "TOP");
        createOutfit(alice, "first", item);
        long second = createOutfit(alice, "second", item);

        setMain(alice, second, 200);

        assertMainOutfit(alice, second);
    }

    @Test
    @DisplayName("the set response already carries the new main outfit id")
    void setReturnsUpdatedUser() throws Exception {
        TestUser alice = registerUser();
        long item = createItem(alice, "shirt", "TOP");
        createOutfit(alice, "first", item);
        long second = createOutfit(alice, "second", item);

        mockMvc.perform(put("/api/users/me/main-outfit")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("outfitId", second))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mainOutfitId").value(second))
                .andExpect(jsonPath("$.email").value(alice.email()));
    }

    @Test
    @DisplayName("another user's outfit cannot be made main (403) and nothing changes")
    void cannotUseSomeoneElsesOutfit() throws Exception {
        TestUser alice = registerUser();
        TestUser mallory = registerUser();
        long aliceOutfit = createOutfit(alice, "alice-look", createItem(alice, "shirt", "TOP"));

        setMain(mallory, aliceOutfit, 403);

        assertMainOutfit(mallory, null);
        assertMainOutfit(alice, aliceOutfit);
    }

    @Test
    @DisplayName("an unknown outfit id is 404, a missing id is 400")
    void unknownAndMissingIds() throws Exception {
        TestUser alice = registerUser();

        setMain(alice, 999999, 404);
        mockMvc.perform(put("/api/users/me/main-outfit")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("deleting the main outfit clears it")
    void deletingMainClearsIt() throws Exception {
        TestUser alice = registerUser();
        long item = createItem(alice, "shirt", "TOP");
        long first = createOutfit(alice, "first", item);
        long second = createOutfit(alice, "second", item);

        mockMvc.perform(delete("/api/outfits/" + first).header("Authorization", alice.bearer()))
                .andExpect(status().isNoContent());

        assertMainOutfit(alice, null);
        // ...and the surviving outfit is untouched (not silently promoted).
        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$[0].outfitId").value(second));
    }

    @Test
    @DisplayName("deleting a non-main outfit leaves the main outfit alone")
    void deletingOtherKeepsMain() throws Exception {
        TestUser alice = registerUser();
        long item = createItem(alice, "shirt", "TOP");
        long first = createOutfit(alice, "first", item);
        long second = createOutfit(alice, "second", item);

        mockMvc.perform(delete("/api/outfits/" + second).header("Authorization", alice.bearer()))
                .andExpect(status().isNoContent());

        assertMainOutfit(alice, first);
    }

    @Test
    @DisplayName("the main outfit can be cleared explicitly")
    void canClear() throws Exception {
        TestUser alice = registerUser();
        createOutfit(alice, "first", createItem(alice, "shirt", "TOP"));

        mockMvc.perform(delete("/api/users/me/main-outfit").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mainOutfitId").value(nullValue()));

        assertMainOutfit(alice, null);
    }

    @Test
    @DisplayName("main outfits are per user")
    void isPerUser() throws Exception {
        TestUser alice = registerUser();
        TestUser bob = registerUser();
        long aliceOutfit = createOutfit(alice, "a", createItem(alice, "shirt", "TOP"));
        long bobOutfit = createOutfit(bob, "b", createItem(bob, "shirt", "TOP"));

        assertMainOutfit(alice, aliceOutfit);
        assertMainOutfit(bob, bobOutfit);
    }

    @Test
    @DisplayName("the endpoints need a signed-in user")
    void requiresAuthentication() throws Exception {
        int code = mockMvc.perform(put("/api/users/me/main-outfit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outfitId\":1}"))
                .andReturn().getResponse().getStatus();
        org.junit.jupiter.api.Assertions.assertTrue(code == 401 || code == 403, "got " + code);
    }
}
