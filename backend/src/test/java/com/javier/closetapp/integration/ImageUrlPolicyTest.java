package com.javier.closetapp.integration;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit M3: a garment's picture address must come from the app's own image host.
class ImageUrlPolicyTest extends IntegrationTestBase {

    private Map<String, Object> body(String imageUrl) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "Tee");
        body.put("category", "TOP");
        body.put("imageUrl", imageUrl);
        body.put("personaType", "MALE");
        return body;
    }

    @ParameterizedTest(name = "{0} is refused")
    @ValueSource(strings = {
            "javascript:alert(1)",
            "data:image/png;base64,AAAA",
            "http://res.cloudinary.com/demo/image/upload/a.png",
            "https://evil.example/tracker.png",
            "https://res.cloudinary.com.evil.example/a.png",
            "https://user@res.cloudinary.com/demo/a.png",
            "//evil.example/a.png",
            "/samples/../../etc/passwd",
            "ftp://res.cloudinary.com/a.png",
            "not a url"
    })
    @DisplayName("creating a garment with an address outside the allowed image host is a 400")
    void createRefusesForeignAddresses(String url) throws Exception {
        TestUser user = registerUser();

        mockMvc.perform(post("/api/clothing").header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(body(url))))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest(name = "{0} is accepted")
    @ValueSource(strings = {
            "https://res.cloudinary.com/demo/image/upload/v1/shirt.png",
            "https://RES.cloudinary.com/demo/image/upload/v1/shirt.png",
            "/samples/black-tee.png"
    })
    @DisplayName("Cloudinary addresses and the app's own sample pictures are accepted")
    void createAcceptsAllowedAddresses(String url) throws Exception {
        TestUser user = registerUser();

        mockMvc.perform(post("/api/clothing").header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(body(url))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("updating a garment cannot swap its picture for a foreign address, and the message is user-facing")
    void updateRefusesForeignAddress() throws Exception {
        TestUser user = registerUser();
        long id = createItem(user, "Tee", "TOP");

        mockMvc.perform(put("/api/clothing/" + id).header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("imageUrl", "https://evil.example/x.png"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The picture must be uploaded through the app."));
    }

    @Test
    @DisplayName("an update that does not touch the picture still works")
    void updateWithoutPictureIsFine() throws Exception {
        TestUser user = registerUser();
        long id = createItem(user, "Tee", "TOP");

        mockMvc.perform(put("/api/clothing/" + id).header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", "Renamed"))))
                .andExpect(status().isOk());
    }
}
