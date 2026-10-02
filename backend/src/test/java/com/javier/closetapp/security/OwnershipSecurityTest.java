package com.javier.closetapp.security;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Blueprint Phase 5, area 1: "Clothing ownership" and "Outfit ownership".
// These lock in the Task 9 IDOR fix - one user must never read, change, delete
// or build on another user's data, and an unauthenticated caller gets nothing.
class OwnershipSecurityTest extends IntegrationTestBase {

    @Test
    @DisplayName("clothing: a user's list contains only their own items")
    void clothingListIsScopedToOwner() throws Exception {
        TestUser alice = registerUser();
        TestUser bob = registerUser();
        createItem(alice, "alice-top", "TOP");

        mockMvc.perform(get("/api/clothing").header("Authorization", bob.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        mockMvc.perform(get("/api/clothing").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("clothing: another user cannot update an item (403) and it is unchanged")
    void clothingUpdateByOtherUserIsForbidden() throws Exception {
        TestUser alice = registerUser();
        TestUser mallory = registerUser();
        long itemId = createItem(alice, "alice-top", "TOP");

        mockMvc.perform(put("/api/clothing/" + itemId)
                        .header("Authorization", mallory.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "hijacked"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/clothing").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$[0].name").value("alice-top"));
    }

    @Test
    @DisplayName("clothing: another user cannot delete an item (403) and it survives")
    void clothingDeleteByOtherUserIsForbidden() throws Exception {
        TestUser alice = registerUser();
        TestUser mallory = registerUser();
        long itemId = createItem(alice, "alice-top", "TOP");

        mockMvc.perform(delete("/api/clothing/" + itemId).header("Authorization", mallory.bearer()))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/clothing").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("clothing: an unknown id is 404 for update and delete")
    void clothingUnknownIdIsNotFound() throws Exception {
        TestUser alice = registerUser();

        mockMvc.perform(put("/api/clothing/999999")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "x"))))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/clothing/999999").header("Authorization", alice.bearer()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("outfits: a user's list contains only their own outfits")
    void outfitListIsScopedToOwner() throws Exception {
        TestUser alice = registerUser();
        TestUser bob = registerUser();
        createOutfit(alice, "alice-look", createItem(alice, "alice-top", "TOP"));

        mockMvc.perform(get("/api/outfits").header("Authorization", bob.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("outfits: another user cannot update an outfit (403) and it is unchanged")
    void outfitUpdateByOtherUserIsForbidden() throws Exception {
        TestUser alice = registerUser();
        TestUser mallory = registerUser();
        long aliceItem = createItem(alice, "alice-top", "TOP");
        long malloryItem = createItem(mallory, "mallory-top", "TOP");
        long outfitId = createOutfit(alice, "alice-look", aliceItem);

        mockMvc.perform(put("/api/outfits/" + outfitId)
                        .header("Authorization", mallory.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfitBody("hijacked", malloryItem))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$[0].name").value("alice-look"));
    }

    @Test
    @DisplayName("outfits: another user cannot delete an outfit (403) and it survives")
    void outfitDeleteByOtherUserIsForbidden() throws Exception {
        TestUser alice = registerUser();
        TestUser mallory = registerUser();
        long outfitId = createOutfit(alice, "alice-look", createItem(alice, "alice-top", "TOP"));

        mockMvc.perform(delete("/api/outfits/" + outfitId).header("Authorization", mallory.bearer()))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("outfits: cannot build an outfit out of another user's clothing (403)")
    void outfitCannotUseAnotherUsersItem() throws Exception {
        TestUser alice = registerUser();
        TestUser mallory = registerUser();
        long aliceItem = createItem(alice, "alice-top", "TOP");

        mockMvc.perform(post("/api/outfits")
                        .header("Authorization", mallory.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfitBody("stolen", aliceItem))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/outfits").header("Authorization", mallory.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("data endpoints reject requests with no token")
    void endpointsRequireAuthentication() throws Exception {
        for (String path : new String[]{"/api/clothing", "/api/outfits", "/api/collections", "/api/users/me"}) {
            int code = mockMvc.perform(get(path)).andReturn().getResponse().getStatus();
            assertTrue(code == 401 || code == 403,
                    path + " should reject anonymous callers but returned " + code);
        }
    }

    @Test
    @DisplayName("admin-only endpoints are forbidden for a normal user")
    void adminEndpointsForbiddenForNormalUser() throws Exception {
        TestUser alice = registerUser();
        TestUser bob = registerUser();

        mockMvc.perform(get("/api/users").header("Authorization", alice.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/users/" + bob.userId() + "/deactivate").header("Authorization", alice.bearer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/users/" + bob.userId() + "/reactivate").header("Authorization", alice.bearer()))
                .andExpect(status().isForbidden());
    }
}
