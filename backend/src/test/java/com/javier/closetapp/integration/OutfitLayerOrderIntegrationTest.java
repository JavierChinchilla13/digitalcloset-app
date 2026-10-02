package com.javier.closetapp.integration;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 86: an outfit can remember how its pieces are stacked on the persona
// (layerOrder, null = the default stacking), and holds at most one shoe per foot.
class OutfitLayerOrderIntegrationTest extends IntegrationTestBase {

    private Map<String, Object> item(long itemId, String slot, Integer layerOrder) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("itemId", itemId);
        m.put("slot", slot);
        if (layerOrder != null) m.put("layerOrder", layerOrder);
        return m;
    }

    private Map<String, Object> outfit(String name, List<Map<String, Object>> items) {
        return Map.of("name", name, "avatarType", "FEMALE", "items", items);
    }

    @Test
    @DisplayName("a saved layer order comes back with the outfit")
    void layerOrderRoundTrips() throws Exception {
        TestUser alice = registerUser();
        long top = createItem(alice, "shirt", "TOP");
        long bottom = createItem(alice, "pants", "BOTTOM");

        // Pants ABOVE the shirt (the reverse of the default stacking).
        mockMvc.perform(post("/api/outfits")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfit("look", List.of(item(top, "top", 0), item(bottom, "bottom", 1))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.itemId == " + top + ")].layerOrder").value(0))
                .andExpect(jsonPath("$.items[?(@.itemId == " + bottom + ")].layerOrder").value(1));
    }

    @Test
    @DisplayName("an outfit saved without a layer order has none (default stacking)")
    void nullByDefault() throws Exception {
        TestUser alice = registerUser();
        long top = createItem(alice, "shirt", "TOP");

        mockMvc.perform(post("/api/outfits")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfit("plain", List.of(item(top, "top", null))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].layerOrder").value(nullValue()));
    }

    @Test
    @DisplayName("updating an outfit replaces its layer order")
    void updateChangesLayerOrder() throws Exception {
        TestUser alice = registerUser();
        long top = createItem(alice, "shirt", "TOP");
        long bottom = createItem(alice, "pants", "BOTTOM");
        long outfitId = createOutfit(alice, "look", top, bottom);

        mockMvc.perform(put("/api/outfits/" + outfitId)
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfit("look", List.of(item(top, "top", 1), item(bottom, "bottom", 0))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.itemId == " + top + ")].layerOrder").value(1))
                .andExpect(jsonPath("$.items[?(@.itemId == " + bottom + ")].layerOrder").value(0));
    }

    @Test
    @DisplayName("one left and one right shoe is fine")
    void onePerFoot() throws Exception {
        TestUser alice = registerUser();
        long left = createItem(alice, "shoe-l", "SHOES");
        long right = createItem(alice, "shoe-r", "SHOES");

        mockMvc.perform(post("/api/outfits")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfit("shoes", List.of(item(left, "leftShoe", null), item(right, "rightShoe", null))))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("two shoes for the same foot are rejected (400) when saving")
    void twoLeftShoesRejected() throws Exception {
        TestUser alice = registerUser();
        long a = createItem(alice, "shoe-a", "SHOES");
        long b = createItem(alice, "shoe-b", "SHOES");

        mockMvc.perform(post("/api/outfits")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfit("bad", List.of(item(a, "leftShoe", null), item(b, "leftShoe", null))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("An outfit can have only one shoe per foot."));
    }

    @Test
    @DisplayName("two shoes for the same foot are rejected (400) when updating, and the outfit is unchanged")
    void twoRightShoesRejectedOnUpdate() throws Exception {
        TestUser alice = registerUser();
        long a = createItem(alice, "shoe-a", "SHOES");
        long b = createItem(alice, "shoe-b", "SHOES");
        long outfitId = createOutfit(alice, "look", a);

        mockMvc.perform(put("/api/outfits/" + outfitId)
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfit("look", List.of(item(a, "rightShoe", null), item(b, "rightShoe", null))))))
                .andExpect(status().isBadRequest());
    }
}
