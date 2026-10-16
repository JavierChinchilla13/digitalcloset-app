package com.javier.closetapp.integration;

import com.jayway.jsonpath.JsonPath;
import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 102: sharing an outfit through a public link. The owner turns the link on and off; anyone with
// the link reads a trimmed-down copy of the outfit without signing in.
class SharedOutfitIntegrationTest extends IntegrationTestBase {

    private String share(TestUser owner, long outfitId) throws Exception {
        String body = mockMvc.perform(post("/api/outfits/" + outfitId + "/share").header("Authorization", owner.bearer()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.shareToken");
    }

    @Test
    @DisplayName("sharing creates a random token, and sharing again returns the same one")
    void tokenIsStable() throws Exception {
        TestUser alice = registerUser();
        long outfit = createOutfit(alice, "look", createItem(alice, "shirt", "TOP"));

        String first = share(alice, outfit);
        String second = share(alice, outfit);

        assertNotNull(first);
        assertEquals(first, second);
        // Random, not the sequential id.
        assertNotEquals(String.valueOf(outfit), first);
        assertEquals(24, first.length());
    }

    @Test
    @DisplayName("an unshared outfit has no token in the owner list; a shared one has")
    void ownerSeesTheToken() throws Exception {
        TestUser alice = registerUser();
        long outfit = createOutfit(alice, "look", createItem(alice, "shirt", "TOP"));

        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$[0].shareToken").doesNotExist());

        String token = share(alice, outfit);

        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$[0].shareToken").value(token));
    }

    @Test
    @DisplayName("anyone can read a shared outfit without signing in, and only the drawing data is in it")
    void publicReadWithoutLogin() throws Exception {
        TestUser alice = registerUser();
        long shirt = createItem(alice, "shirt", "TOP");
        long pants = createItem(alice, "pants", "BOTTOM");
        long outfit = createOutfit(alice, "Sunday look", shirt, pants);
        String token = share(alice, outfit);

        mockMvc.perform(get("/api/public/outfits/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Sunday look"))
                .andExpect(jsonPath("$.avatarType").value("FEMALE"))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.garments", hasSize(2)))
                .andExpect(jsonPath("$.garments[0].imageUrl").exists())
                .andExpect(jsonPath("$.garments[0].transform").exists())
                // Nothing about the owner or the account leaks.
                .andExpect(content().string(not(containsString(alice.email()))))
                .andExpect(content().string(not(containsString("userId"))))
                .andExpect(content().string(not(containsString("plan"))))
                .andExpect(content().string(not(containsString("description"))))
                .andExpect(content().string(not(containsString("uploadDate"))));
    }

    @Test
    @DisplayName("turning the link off makes it a 404, and sharing again gives a new token")
    void revoke() throws Exception {
        TestUser alice = registerUser();
        long outfit = createOutfit(alice, "look", createItem(alice, "shirt", "TOP"));
        String token = share(alice, outfit);

        mockMvc.perform(delete("/api/outfits/" + outfit + "/share").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").doesNotExist());
        mockMvc.perform(get("/api/public/outfits/" + token)).andExpect(status().isNotFound());

        String newToken = share(alice, outfit);
        assertNotEquals(token, newToken);
        mockMvc.perform(get("/api/public/outfits/" + token)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/outfits/" + newToken)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("an unknown token is a 404")
    void unknownToken() throws Exception {
        mockMvc.perform(get("/api/public/outfits/not-a-real-token")).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("another user cannot share or unshare an outfit that is not theirs")
    void ownershipIsEnforced() throws Exception {
        TestUser alice = registerUser();
        TestUser mallory = registerUser();
        long outfit = createOutfit(alice, "look", createItem(alice, "shirt", "TOP"));

        mockMvc.perform(post("/api/outfits/" + outfit + "/share").header("Authorization", mallory.bearer()))
                .andExpect(status().isForbidden());
        share(alice, outfit);
        mockMvc.perform(delete("/api/outfits/" + outfit + "/share").header("Authorization", mallory.bearer()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("sharing needs a login")
    void sharingNeedsLogin() throws Exception {
        mockMvc.perform(post("/api/outfits/1/share")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a garment the owner deleted is left out of the public view")
    void deletedGarmentsAreHidden() throws Exception {
        TestUser alice = registerUser();
        long shirt = createItem(alice, "shirt", "TOP");
        long pants = createItem(alice, "pants", "BOTTOM");
        long outfit = createOutfit(alice, "look", shirt, pants);
        String token = share(alice, outfit);

        mockMvc.perform(delete("/api/clothing/" + pants).header("Authorization", alice.bearer()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/public/outfits/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.garments", hasSize(1)))
                .andExpect(jsonPath("$.garments[0].itemId").value((int) shirt));
    }

    @Test
    @DisplayName("deleting the outfit ends its link")
    void deleteEndsTheLink() throws Exception {
        TestUser alice = registerUser();
        long outfit = createOutfit(alice, "look", createItem(alice, "shirt", "TOP"));
        String token = share(alice, outfit);

        mockMvc.perform(delete("/api/outfits/" + outfit).header("Authorization", alice.bearer()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/public/outfits/" + token)).andExpect(status().isNotFound());
    }
}
