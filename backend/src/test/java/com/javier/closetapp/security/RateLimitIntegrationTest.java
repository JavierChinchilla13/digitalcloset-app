package com.javier.closetapp.security;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 24: the limit as wired into the real security chain (the unit test covers
// the filter's rules; this proves the app actually applies it). A tiny limit, and
// its own application context, so the other tests keep running unlimited.
@TestPropertySource(properties = {
        "app.rate-limit.enabled=true",
        "app.rate-limit.auth.max-requests=3",
        "app.rate-limit.auth.window-seconds=60"
})
class RateLimitIntegrationTest extends IntegrationTestBase {

    @Test
    @DisplayName("repeated login attempts are turned away with 429 once the limit is passed")
    void loginIsLimited() throws Exception {
        String body = "{\"email\":\"nobody@example.com\",\"password\":\"wrong-password\"}";

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("the rest of the API is not subject to it")
    void restOfTheApiIsNotLimited() throws Exception {
        for (int i = 0; i < 6; i++) {
            // Always "not signed in" (401, Task 95; it was an empty 403) - never 429.
            mockMvc.perform(get("/api/clothing")).andExpect(status().isUnauthorized());
        }
    }
}
