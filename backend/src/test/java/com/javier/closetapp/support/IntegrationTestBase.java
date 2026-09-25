package com.javier.closetapp.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Shared setup for the integration tests (Task 23): boots the real app (all
// filters, real JWT handling, real services and repositories) against the
// in-memory test database and drives it over HTTP with MockMvc. The context is
// cached across test classes, so every test creates its own uniquely-named
// users instead of assuming an empty database.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class IntegrationTestBase {

    protected static final String PASSWORD = "Sup3r-secret-pw";

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;

    /** A registered user's identity, as returned by /api/auth/register. */
    public record TestUser(long userId, String email, String token) {
        public String bearer() {
            return "Bearer " + token;
        }
    }

    protected String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    protected String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    protected TestUser registerUser() throws Exception {
        String email = uniqueEmail();
        String body = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new TestUser(
                ((Number) JsonPath.read(body, "$.userId")).longValue(),
                email,
                JsonPath.read(body, "$.token"));
    }

    protected ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email, "password", password))));
    }

    /** Creates a clothing item for the user and returns its id. */
    protected long createItem(TestUser user, String name, String category) throws Exception {
        String body = mockMvc.perform(post("/api/clothing")
                        .header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", name,
                                "category", category,
                                "imageUrl", "https://res.cloudinary.com/test/image/upload/" + name + ".png",
                                "personaType", "FEMALE"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.itemId")).longValue();
    }

    protected Map<String, Object> outfitBody(String name, long... itemIds) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < itemIds.length; i++) {
            items.add(Map.of("itemId", itemIds[i], "slot", "slot-" + i, "itemOrder", i));
        }
        return Map.of("name", name, "avatarType", "FEMALE", "items", items);
    }

    /** Creates an outfit for the user and returns its id. */
    protected long createOutfit(TestUser user, String name, long... itemIds) throws Exception {
        String body = mockMvc.perform(post("/api/outfits")
                        .header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(outfitBody(name, itemIds))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.outfitId")).longValue();
    }
}
