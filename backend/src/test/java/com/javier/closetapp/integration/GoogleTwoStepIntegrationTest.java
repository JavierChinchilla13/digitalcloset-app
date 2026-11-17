package com.javier.closetapp.integration;

import com.javier.closetapp.legal.LegalVersion;
import com.javier.closetapp.support.FakeGoogleTokenVerifier;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit H12: a NEW Google sign-up has two steps. The first (POST /api/auth/google) verifies the identity and creates NOTHING;
// the second (POST /api/auth/google/complete) re-verifies it and takes the birth month/year and the acceptances, with the same
// rules and the same refusal as a password sign-up. Google itself is faked (FakeGoogleTokenVerifier).
class GoogleTwoStepIntegrationTest extends IntegrationTestBase {

    private String sub() {
        return "sub-" + UUID.randomUUID();
    }

    private String credential(String sub, String email) {
        return FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace");
    }

    private ResultActions google(String credential) throws Exception {
        return mockMvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(json(Map.of("credential", credential))));
    }

    // The second-step body for someone born `monthsAgo` months before today.
    private Map<String, Object> completeBody(String credential, int monthsAgo, boolean guardian) {
        LocalDate d = LocalDate.now(ZoneOffset.UTC).minusMonths(monthsAgo);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("credential", credential);
        body.put("birthYear", d.getYear());
        body.put("birthMonth", d.getMonthValue());
        body.put("guardianAuthorized", guardian);
        body.put("termsAccepted", true);
        body.put("dataAuthorized", true);
        body.put("legalVersion", LegalVersion.CURRENT);
        return body;
    }

    private ResultActions complete(Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/api/auth/google/complete").contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    @Test
    @DisplayName("step 1: a new Google identity is told to complete its profile, and NOTHING is created (no account, no token)")
    void firstStepCreatesNothing() throws Exception {
        String email = uniqueEmail();
        long before = userRepository.count();

        google(credential(sub(), email))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needsProfile").value(true))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.token").doesNotExist());

        assertEquals(before, userRepository.count());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    @DisplayName("step 2: an adult completes the sign-up; the account has the Google profile, the declarations and a working token")
    void adultCompletes() throws Exception {
        String sub = sub();
        String email = uniqueEmail();

        String body = complete(completeBody(credential(sub, email), 30 * 12, false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needsProfile").value(false))
                .andReturn().getResponse().getContentAsString();

        User user = userRepository.findByEmail(email).orElseThrow();
        assertEquals("Ada", user.getFirstName());
        assertEquals(sub, user.getGoogleId());
        assertEquals(LegalVersion.CURRENT, user.getTermsVersion());
        assertNotNull(user.getTermsAcceptedAt());
        assertNotNull(user.getDataAuthorizedAt());
        assertFalse(user.isGuardianAuthorized());
        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + objectMapper.readTree(body).get("token").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    @DisplayName("step 2: someone aged 13-17 needs the guardian declaration, and it is recorded when given")
    void minorNeedsGuardian() throws Exception {
        String email = uniqueEmail();
        String cred = credential(sub(), email);

        complete(completeBody(cred, 15 * 12, false))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A parent or legal guardian must authorise the use of your account and data."));
        assertTrue(userRepository.findByEmail(email).isEmpty());

        complete(completeBody(cred, 15 * 12, true)).andExpect(status().isOk());
        User user = userRepository.findByEmail(email).orElseThrow();
        assertTrue(user.isGuardianAuthorized());
        assertNotNull(user.getGuardianAuthorizedAt());
    }

    @Test
    @DisplayName("step 2: someone under 13 gets the same uniform 403 as a password sign-up, and nothing is created")
    void underMinimumIsRefused() throws Exception {
        String email = uniqueEmail();
        long before = userRepository.count();

        complete(completeBody(credential(sub(), email), 9 * 12, true))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AGE_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value("We can't create an account with this information."));

        assertEquals(before, userRepository.count());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    @DisplayName("step 2: the age is checked before the Google credential, so a refusal is the same for everyone")
    void ageIsCheckedBeforeTheCredential() throws Exception {
        complete(completeBody("garbage", 9 * 12, true)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("step 2: the Google credential is verified again; a bad or unverified one creates nothing")
    void credentialIsVerifiedAgain() throws Exception {
        complete(completeBody("garbage", 30 * 12, false)).andExpect(status().isUnauthorized());

        String email = uniqueEmail();
        complete(completeBody(FakeGoogleTokenVerifier.credential(sub(), email, false, "A", "B"), 30 * 12, false))
                .andExpect(status().isUnauthorized());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    @DisplayName("step 2: both acceptances and the current version are required")
    void declarationsAreRequired() throws Exception {
        String email = uniqueEmail();
        String cred = credential(sub(), email);
        Map<String, Object> noTerms = completeBody(cred, 30 * 12, false);
        noTerms.put("termsAccepted", false);
        Map<String, Object> noData = completeBody(cred, 30 * 12, false);
        noData.remove("dataAuthorized");
        Map<String, Object> stale = completeBody(cred, 30 * 12, false);
        stale.put("legalVersion", "2020-01-old");

        complete(noTerms).andExpect(status().isBadRequest());
        complete(noData).andExpect(status().isBadRequest());
        complete(stale).andExpect(status().isBadRequest());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    @DisplayName("an identity that already has an account just signs in at step 2: no second account, recorded facts untouched")
    void existingIdentitySignsIn() throws Exception {
        String sub = sub();
        String email = uniqueEmail();
        long first = objectMapper.readTree(complete(completeBody(credential(sub, email), 30 * 12, false)).andReturn().getResponse().getContentAsString()).get("userId").asLong();
        long before = userRepository.count();
        Integer yearBefore = userRepository.findByEmail(email).orElseThrow().getBirthYear();

        // Different birth data this time: it must not overwrite what was recorded.
        long second = objectMapper.readTree(complete(completeBody(credential(sub, email), 40 * 12, false)).andReturn().getResponse().getContentAsString()).get("userId").asLong();

        assertEquals(first, second);
        assertEquals(before, userRepository.count());
        assertEquals(yearBefore, userRepository.findByEmail(email).orElseThrow().getBirthYear());
    }

    @Test
    @DisplayName("a password account with the same email is still linked at step 1 (it already exists), as before")
    void existingPasswordAccountIsLinkedAtStepOne() throws Exception {
        TestUser existing = registerUser();

        google(credential(sub(), existing.email()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needsProfile").value(false))
                .andExpect(jsonPath("$.userId").value(existing.userId()));
    }
}
