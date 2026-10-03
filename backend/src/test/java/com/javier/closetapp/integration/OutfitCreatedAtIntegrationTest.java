package com.javier.closetapp.integration;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 92: outfits come back with the date they were saved. The outfit cards display
// it, and the API used to leave it out, so every card read "Invalid Date".
class OutfitCreatedAtIntegrationTest extends IntegrationTestBase {

    @Test
    @DisplayName("a saved outfit is listed with its creation date (ISO date-time)")
    void listedWithCreatedAt() throws Exception {
        TestUser alice = registerUser();
        long top = createItem(alice, "shirt", "TOP");
        createOutfit(alice, "look", top);

        mockMvc.perform(get("/api/outfits").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].createdAt").value(matchesPattern("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.*")));
    }
}
