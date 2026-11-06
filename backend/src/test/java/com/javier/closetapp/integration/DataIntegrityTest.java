package com.javier.closetapp.integration;

import com.jayway.jsonpath.JsonPath;
import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit area 2: deleting an outfit that is in a category (H3), text limits (H7), duplicate category names (M9)
// and deleted garments inside outfits and categories (M10).
class DataIntegrityTest extends IntegrationTestBase {

    private long createCollection(TestUser user, String name) throws Exception {
        String body = mockMvc.perform(post("/api/collections").header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", name))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.collectionId")).longValue();
    }

    private ResultActions postCollection(TestUser user, String name) throws Exception {
        return mockMvc.perform(post("/api/collections").header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", name))));
    }

    private void deleteItem(TestUser user, long id) throws Exception {
        mockMvc.perform(delete("/api/clothing/" + id).header("Authorization", user.bearer()))
                .andExpect(status().is2xxSuccessful());
    }

    // ---- H3 ----

    @Test
    @DisplayName("deleting an outfit that sits in a category works and takes it out of the category")
    void deleteOutfitInACategory() throws Exception {
        TestUser user = registerUser();
        long shirt = createItem(user, "Shirt", "TOP");
        long outfit = createOutfit(user, "Look", shirt);
        long keep = createOutfit(user, "Keeper", shirt);
        long collection = createCollection(user, "Summer");
        mockMvc.perform(post("/api/collections/" + collection + "/outfits/" + outfit).header("Authorization", user.bearer()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/collections/" + collection + "/outfits/" + keep).header("Authorization", user.bearer()))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/outfits/" + outfit).header("Authorization", user.bearer()))
                .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/collections").header("Authorization", user.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].outfits.length()").value(1))
                .andExpect(jsonPath("$[0].outfits[0].outfitId").value(keep));
    }

    // ---- H7 ----

    private Map<String, Object> garment(String name, String description) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("description", description);
        body.put("category", "TOP");
        body.put("imageUrl", "https://res.cloudinary.com/test/image/upload/x.png");
        body.put("personaType", "MALE");
        return body;
    }

    @Test
    @DisplayName("a garment name over 100 characters or a description over 255 is a 400 with a clear message, not a 500")
    void garmentTextLimits() throws Exception {
        TestUser user = registerUser();

        mockMvc.perform(post("/api/clothing").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(garment("x".repeat(101), null))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/clothing").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(garment("ok", "d".repeat(256)))))
                .andExpect(status().isBadRequest());
        // The limits themselves are allowed.
        mockMvc.perform(post("/api/clothing").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(garment("x".repeat(100), "d".repeat(255)))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("updating a garment applies the same limits, and a blank name is refused")
    void garmentUpdateLimits() throws Exception {
        TestUser user = registerUser();
        long id = createItem(user, "Tee", "TOP");

        mockMvc.perform(put("/api/clothing/" + id).header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "x".repeat(101)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Name must be at most 100 characters."));
        mockMvc.perform(put("/api/clothing/" + id).header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("description", "d".repeat(256)))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/clothing/" + id).header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "   "))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("outfit, category and persona names have limits too")
    void otherNameLimits() throws Exception {
        TestUser user = registerUser();
        long shirt = createItem(user, "Shirt", "TOP");

        Map<String, Object> outfit = outfitBody("x".repeat(101), shirt);
        mockMvc.perform(post("/api/outfits").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfit)))
                .andExpect(status().isBadRequest());

        postCollection(user, "c".repeat(101)).andExpect(status().isBadRequest());
        postCollection(user, "c".repeat(100)).andExpect(status().isOk());

        mockMvc.perform(put("/api/persona-display-names/MALE").header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("displayName", "p".repeat(31)))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/persona-display-names/MALE").header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("displayName", "p".repeat(30)))))
                .andExpect(status().isOk());
    }

    // ---- M9 ----

    @Test
    @DisplayName("a second category with the same name, in any capitals, is a 409 with a clear message")
    void duplicateCategoryName() throws Exception {
        TestUser user = registerUser();
        createCollection(user, "Summer");

        postCollection(user, "summer").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You already have a category with this name."));
        postCollection(user, "  SUMMER  ").andExpect(status().isConflict());
    }

    @Test
    @DisplayName("another user may use the same category name")
    void sameNameForAnotherUser() throws Exception {
        TestUser alice = registerUser();
        TestUser bob = registerUser();
        createCollection(alice, "Summer");

        postCollection(bob, "Summer").andExpect(status().isOk());
    }

    @Test
    @DisplayName("renaming to another category's name is a 409; changing only the capitals of its own name is fine")
    void renameRules() throws Exception {
        TestUser user = registerUser();
        long summer = createCollection(user, "Summer");
        createCollection(user, "Winter");

        mockMvc.perform(put("/api/collections/" + summer).header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", "winter"))))
                .andExpect(status().isConflict());
        mockMvc.perform(put("/api/collections/" + summer).header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", "SUMMER"))))
                .andExpect(status().isOk());
    }

    // ---- M10 ----

    @Test
    @DisplayName("a deleted garment no longer shows inside saved outfits or categories")
    void deletedGarmentIsHidden() throws Exception {
        TestUser user = registerUser();
        long shirt = createItem(user, "Shirt", "TOP");
        long pants = createItem(user, "Pants", "BOTTOM");
        long outfit = createOutfit(user, "Look", shirt, pants);
        long collection = createCollection(user, "Summer");
        mockMvc.perform(post("/api/collections/" + collection + "/items/" + shirt).header("Authorization", user.bearer()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/collections/" + collection + "/items/" + pants).header("Authorization", user.bearer()))
                .andExpect(status().isOk());

        deleteItem(user, shirt);

        mockMvc.perform(get("/api/outfits").header("Authorization", user.bearer()))
                .andExpect(jsonPath("$[?(@.outfitId==" + outfit + ")].items.length()").value(1));
        mockMvc.perform(get("/api/collections").header("Authorization", user.bearer()))
                .andExpect(jsonPath("$[0].items.length()").value(1))
                .andExpect(jsonPath("$[0].items[0].itemId").value(pants));
    }

    @Test
    @DisplayName("a deleted garment cannot be edited, put in an outfit or added to a category")
    void deletedGarmentCannotBeUsed() throws Exception {
        TestUser user = registerUser();
        long shirt = createItem(user, "Shirt", "TOP");
        long collection = createCollection(user, "Summer");
        deleteItem(user, shirt);

        mockMvc.perform(put("/api/clothing/" + shirt).header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", "Renamed"))))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/outfits").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfitBody("Look", shirt))))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/collections/" + collection + "/items/" + shirt).header("Authorization", user.bearer()))
                .andExpect(status().isNotFound());
    }

    // ---- M9: a sign-up racing for one email ----

    @Test
    @DisplayName("a violated uniqueness rule that no service checked is a 409, not a 500")
    void duplicateEmailStaysA409() throws Exception {
        TestUser user = registerUser();

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", user.email(), "password", PASSWORD))))
                .andExpect(status().isConflict());
    }
}
