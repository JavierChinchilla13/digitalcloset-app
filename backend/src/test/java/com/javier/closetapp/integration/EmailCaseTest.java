package com.javier.closetapp.integration;

import com.jayway.jsonpath.JsonPath;
import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit M8: one email address is one account, whatever its capitals.
class EmailCaseTest extends IntegrationTestBase {

    private String register(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json(registrationBody(email, PASSWORD))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    @DisplayName("an address is stored in lower case and the account is found whatever case is typed at sign-in")
    void storedLowerCaseAndFoundAnyCase() throws Exception {
        String local = "Mixed" + UUID.randomUUID().toString().substring(0, 8);
        String body = register(local + "@Example.COM");

        assertEquals((local + "@example.com").toLowerCase(), JsonPath.read(body, "$.email"));
        login(local.toUpperCase() + "@EXAMPLE.com", PASSWORD).andExpect(status().isOk());
        login(local.toLowerCase() + "@example.com", PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("registering the same address with different capitals is a duplicate")
    void differentCaseIsADuplicate() throws Exception {
        String local = "dup" + UUID.randomUUID().toString().substring(0, 8);
        register(local + "@example.com");

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json(registrationBody(local.toUpperCase() + "@Example.com", PASSWORD))))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("a token made at an upper-case sign-in works")
    void tokenFromUpperCaseLoginWorks() throws Exception {
        String local = "tok" + UUID.randomUUID().toString().substring(0, 8);
        register(local + "@example.com");
        String body = login(local.toUpperCase() + "@EXAMPLE.COM", PASSWORD).andReturn().getResponse().getContentAsString();

        mockMvc.perform(get("/api/clothing").header("Authorization", "Bearer " + JsonPath.<String>read(body, "$.token")))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("changing the email to the same address with other capitals is not seen as taken by another account")
    void passwordResetFindsTheAccountAnyCase() throws Exception {
        String local = "rst" + UUID.randomUUID().toString().substring(0, 8);
        register(local + "@example.com");

        mockMvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", local.toUpperCase() + "@Example.com"))))
                .andExpect(status().is2xxSuccessful());
    }
}
