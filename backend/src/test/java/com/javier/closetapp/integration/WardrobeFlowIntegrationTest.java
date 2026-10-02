package com.javier.closetapp.integration;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Blueprint Phase 5, areas 3 and 6: the whole backend journey through the real
// filter chain and database - Register -> Login -> Create clothing -> Create
// outfit -> Delete clothing -> Verify permissions - and the outfit round trip
// (create -> backend -> reload -> backend).
class WardrobeFlowIntegrationTest extends IntegrationTestBase {

    @Test
    @DisplayName("register -> login -> clothing -> outfit -> delete clothing -> permissions still hold")
    void fullJourney() throws Exception {
        // Register, then log in with a fresh token, as the real UI does.
        TestUser registered = registerUser();
        String token = objectMapper.readTree(login(registered.email(), PASSWORD)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("token").asText();
        TestUser alice = new TestUser(registered.userId(), registered.email(), token);
        TestUser mallory = registerUser();

        // Create two garments and an outfit from them.
        long top = createItem(alice, "white-shirt", "TOP");
        long bottom = createItem(alice, "blue-jeans", "BOTTOM");
        long outfitId = createOutfit(alice, "weekend", top, bottom);

        mockMvc.perform(get("/api/clothing").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$", hasSize(2)));
        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].items", hasSize(2)));

        // Another user can neither delete the garment nor see it.
        mockMvc.perform(delete("/api/clothing/" + top).header("Authorization", mallory.bearer()))
                .andExpect(status().isForbidden());

        // The owner deletes a garment: it leaves the closet list (soft delete)...
        mockMvc.perform(delete("/api/clothing/" + top).header("Authorization", alice.bearer()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/clothing").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("blue-jeans"));

        // ...and the outfit survives, still owned by alice and hidden from mallory.
        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].outfitId").value(outfitId));
        mockMvc.perform(get("/api/outfits").header("Authorization", mallory.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("an outfit round-trips: what was saved is what comes back after a reload")
    void outfitRoundTrip() throws Exception {
        TestUser alice = registerUser();
        long top = createItem(alice, "white-shirt", "TOP");
        long shoes = createItem(alice, "sneakers", "SHOES");
        long outfitId = createOutfit(alice, "street", top, shoes);

        // "Reload": a brand-new request lists the outfit from the database.
        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].outfitId").value(outfitId))
                .andExpect(jsonPath("$[0].name").value("street"))
                .andExpect(jsonPath("$[0].avatarType").value("FEMALE"))
                .andExpect(jsonPath("$[0].items", hasSize(2)))
                .andExpect(jsonPath("$[0].items[0].itemId").value(top))
                .andExpect(jsonPath("$[0].items[0].itemName").value("white-shirt"))
                .andExpect(jsonPath("$[0].items[1].itemId").value(shoes));

        // Editing replaces the items and the change is visible on the next read.
        mockMvc.perform(put("/api/outfits/" + outfitId)
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfitBody("street v2", shoes))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$[0].name").value("street v2"))
                .andExpect(jsonPath("$[0].items", hasSize(1)))
                .andExpect(jsonPath("$[0].items[0].itemId").value(shoes));

        // Deleting removes it for good.
        mockMvc.perform(delete("/api/outfits/" + outfitId).header("Authorization", alice.bearer()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("invalid payloads are rejected with 400, not saved or crashed on")
    void invalidPayloadsAreRejected() throws Exception {
        TestUser alice = registerUser();

        // Clothing missing its required fields.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/clothing")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest());
        // An outfit with no items.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/outfits")
                        .header("Authorization", alice.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfitBody("empty"))))
                .andExpect(status().isBadRequest());
    }
}
