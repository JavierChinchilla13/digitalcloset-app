package com.javier.closetapp.security;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 24: a mistake in the request is a 4xx, never a 500 "unexpected error".
// Found while running the packaged app with the production profile: a request
// with broken JSON came back as a 500.
class ClientErrorResponsesTest extends IntegrationTestBase {

    @Test
    @DisplayName("broken JSON is a 400, with a fixed message (not the parser's text)")
    void brokenJson() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("{bad json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed request"));
    }

    @Test
    @DisplayName("an empty body where one is required is a 400")
    void emptyBody() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("the wrong content type is a 415")
    void wrongContentType() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.TEXT_PLAIN).content("hello"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    @DisplayName("the wrong HTTP method on a real path is a 405")
    void wrongMethod() throws Exception {
        mockMvc.perform(get("/api/auth/login")).andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("a non-numeric id in the path is a 400, for a signed-in user")
    void badPathVariable() throws Exception {
        TestUser user = registerUser();
        mockMvc.perform(delete("/api/outfits/not-a-number").header("Authorization", user.bearer()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("an unknown path for a signed-in user is a 404")
    void unknownPath() throws Exception {
        TestUser user = registerUser();
        mockMvc.perform(get("/api/does-not-exist").header("Authorization", user.bearer()))
                .andExpect(status().isNotFound());
    }
}
