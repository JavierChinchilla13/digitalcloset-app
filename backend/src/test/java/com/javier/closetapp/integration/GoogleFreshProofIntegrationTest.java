package com.javier.closetapp.integration;

import com.javier.closetapp.auth.service.GoogleTokenUseLog;
import com.javier.closetapp.auth.service.ReauthFailureRepository;
import com.javier.closetapp.legal.LegalVersion;
import com.javier.closetapp.support.FakeGoogleTokenVerifier;
import com.javier.closetapp.support.IntegrationTestBase;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// A Google "it is me" proof must be GENUINELY fresh (the token was issued in the last 5 minutes) and used ONCE: not twice, and not if the
// same token already signed someone in. Tested through "delete my account" (which the website uses) and the admin backup.
class GoogleFreshProofIntegrationTest extends IntegrationTestBase {

    private static final String ARCHIVE_PASSWORD = "an archive passphrase 123";

    @Autowired private ReauthFailureRepository failures;

    // A Google-only account: signed up through the two-step flow with `signupCredential`. Returns the id, the bearer, the Google subject and email.
    private record GoogleAccount(long userId, String bearer, String sub, String email, String signupCredential) { }

    private GoogleAccount googleAccount() throws Exception {
        String sub = "sub-" + UUID.randomUUID();
        String email = uniqueEmail();
        String credential = FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace");
        Map<String, Object> signup = new LinkedHashMap<>();
        signup.put("credential", credential);
        signup.put("birthYear", 1990);
        signup.put("birthMonth", 5);
        signup.put("guardianAuthorized", false);
        signup.put("termsAccepted", true);
        signup.put("dataAuthorized", true);
        signup.put("legalVersion", LegalVersion.CURRENT);
        String signedUp = mockMvc.perform(post("/api/auth/google/complete").contentType(MediaType.APPLICATION_JSON).content(json(signup)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new GoogleAccount(((Number) JsonPath.read(signedUp, "$.userId")).longValue(), "Bearer " + JsonPath.<String>read(signedUp, "$.token"), sub, email, credential);
    }

    private ResultActions delete(GoogleAccount a, String credential) throws Exception {
        return mockMvc.perform(post("/api/users/me/delete").header("Authorization", a.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("confirmation", "DELETE", "googleCredential", credential))));
    }

    private String issuedAgo(GoogleAccount a, long seconds) {
        return FakeGoogleTokenVerifier.credential(a.sub(), a.email(), true, "Ada", "Lovelace", Instant.now().minusSeconds(seconds));
    }

    @Test
    @DisplayName("a token issued a few seconds ago confirms the deletion")
    void freshTokenWorks() throws Exception {
        GoogleAccount a = googleAccount();
        delete(a, issuedAgo(a, 5)).andExpect(status().isNoContent());
        assertTrue(userRepository.findByEmail(a.email()).isEmpty());
    }

    @Test
    @DisplayName("a token 4 minutes old is still accepted; 6 minutes old, or from the future, is refused (403) and the account stays")
    void ageWindow() throws Exception {
        GoogleAccount refused = googleAccount();
        delete(refused, issuedAgo(refused, 6 * 60)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Google sign-in is too old to confirm this. Please sign in with Google again."));
        delete(refused, issuedAgo(refused, -5 * 60)).andExpect(status().isForbidden());      // issued "in the future"
        delete(refused, issuedAgo(refused, 24 * 3600)).andExpect(status().isForbidden());    // a day old: valid for Google, useless here
        assertTrue(userRepository.findByEmail(refused.email()).isPresent());

        GoogleAccount accepted = googleAccount();
        delete(accepted, issuedAgo(accepted, 4 * 60)).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("the token that signed the person in cannot be used again as proof, even though it is still fresh")
    void signInTokenCannotBeReused() throws Exception {
        GoogleAccount a = googleAccount();
        delete(a, a.signupCredential()).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Google sign-in was already used. Please sign in with Google again."));
        assertTrue(userRepository.findByEmail(a.email()).isPresent());
        // A brand new sign-in is what proves it is them.
        delete(a, issuedAgo(a, 2)).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("a token that signs in through the plain Google endpoint is marked used too")
    void plainGoogleLoginMarksTheTokenUsed() throws Exception {
        GoogleAccount a = googleAccount();
        String loginToken = issuedAgo(a, 1);
        mockMvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(json(Map.of("credential", loginToken))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
        delete(a, loginToken).andExpect(status().isForbidden());
        assertTrue(userRepository.findByEmail(a.email()).isPresent());
    }

    @Test
    @DisplayName("a token cannot confirm two actions: the second use of the same token is refused (admin backup)")
    void tokenIsSingleUse() throws Exception {
        GoogleAccount a = googleAccount();
        promoteToAdmin(new TestUser(a.userId(), a.email(), a.bearer().substring(7)));
        String proof = issuedAgo(a, 3);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("googleCredential", proof);
        body.put("archivePassword", ARCHIVE_PASSWORD);

        mockMvc.perform(post("/api/admin/backup").header("Authorization", a.bearer()).contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/admin/backup").header("Authorization", a.bearer()).contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("a refused token counts as a wrong proof (it adds to the persisted throttle), and a token for ANOTHER Google account is never consumed")
    void refusalsCountAndForeignTokensAreNotConsumed() throws Exception {
        GoogleAccount a = googleAccount();
        long before = failures.countByUserIdAndFailedAtAfter(a.userId(), LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
        delete(a, issuedAgo(a, 20 * 60)).andExpect(status().isForbidden());
        assertEquals(before + 1, failures.countByUserIdAndFailedAtAfter(a.userId(), LocalDateTime.now(ZoneOffset.UTC).minusDays(1)));

        String foreign = FakeGoogleTokenVerifier.credential("sub-someone-else", a.email(), true, "X", "Y", Instant.now());
        delete(a, foreign).andExpect(status().isForbidden());
        // The foreign token was not recorded as used by this refusal: the same string is still unknown to the log.
        // (It is refused again for the same reason, not because it was "already used".)
        delete(a, foreign).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Google could not confirm it is you. Please try again."));
    }

    @Test
    @DisplayName("only a fingerprint of the token is kept, never the token")
    void onlyAFingerprintIsKept() {
        String token = "ok|sub|e@x|true|A|B|1|abc";
        String fingerprint = GoogleTokenUseLog.fingerprint(token);
        assertEquals(64, fingerprint.length());
        assertFalse(fingerprint.contains("sub"));
        assertNotEquals(token, fingerprint);
        assertEquals(fingerprint, GoogleTokenUseLog.fingerprint(token));
    }
}
