package com.javier.closetapp.integration;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.javier.closetapp.auth.service.ReauthFailure;
import com.javier.closetapp.auth.service.ReauthFailureRepository;
import com.javier.closetapp.legal.LegalVersion;
import com.javier.closetapp.support.FakeGoogleTokenVerifier;
import com.javier.closetapp.support.IntegrationTestBase;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Wrong "it is me" proofs are counted per account in the DATABASE and shared by every action that asks for one: delete account, password
// change, email change (and the admin backup). After 5 wrong ones in 15 minutes the account gets 429 for all of them, even with the right
// password, until the window passes; a right proof clears the count; nothing but the account number and the time is stored.
class ReauthThrottleIntegrationTest extends IntegrationTestBase {

    @Autowired private ReauthFailureRepository failures;

    private ResultActions delete(TestUser user, String password) throws Exception {
        return mockMvc.perform(post("/api/users/me/delete").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("confirmation", "DELETE", "password", password))));
    }

    private ResultActions changePassword(TestUser user, String current) throws Exception {
        return mockMvc.perform(post("/api/users/me/password/request").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("currentPassword", current, "newPassword", "A-brand-new-pw-123"))));
    }

    private ResultActions changeEmail(TestUser user, String current) throws Exception {
        return mockMvc.perform(post("/api/users/me/email/request").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("newEmail", uniqueEmail(), "currentPassword", current))));
    }

    private long count(TestUser user) {
        return failures.countByUserIdAndFailedAtAfter(user.userId(), LocalDateTime.now(ZoneOffset.UTC).minusDays(2));
    }

    @Test
    @DisplayName("five wrong passwords at \"delete my account\" are 403 and stored; the sixth try, even with the right password, is 429 and the account stays")
    void deleteAccountIsThrottled() throws Exception {
        TestUser user = registerUser();
        for (int i = 0; i < 5; i++) delete(user, "wrong-password-" + i).andExpect(status().isForbidden());
        assertEquals(5, count(user));

        delete(user, PASSWORD).andExpect(status().isTooManyRequests());
        assertTrue(userRepository.findByEmail(user.email()).isPresent(), "the account must still exist");
    }

    @Test
    @DisplayName("the count is shared: wrong guesses at the password change, the email change and the account deletion add up (and survive the rollback of the request)")
    void sharedAcrossActions() throws Exception {
        TestUser user = registerUser();
        changePassword(user, "nope-1").andExpect(status().isForbidden());
        changeEmail(user, "nope-2").andExpect(status().isForbidden());
        delete(user, "nope-3").andExpect(status().isForbidden());
        changePassword(user, "nope-4").andExpect(status().isForbidden());
        changeEmail(user, "nope-5").andExpect(status().isForbidden());
        assertEquals(5, count(user));

        changePassword(user, PASSWORD).andExpect(status().isTooManyRequests());
        changeEmail(user, PASSWORD).andExpect(status().isTooManyRequests());
        delete(user, PASSWORD).andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("failures older than the 15-minute window no longer count: the right password works again")
    void windowExpires() throws Exception {
        TestUser user = registerUser();
        LocalDateTime old = LocalDateTime.now(ZoneOffset.UTC).minusMinutes(20);
        for (int i = 0; i < 8; i++) failures.save(new ReauthFailure(user.userId(), old));

        changePassword(user, PASSWORD).andExpect(status().is2xxSuccessful());
    }

    @Test
    @DisplayName("four wrong guesses then the right password: it works and the count is cleared, so four more guesses are allowed")
    void successClearsTheCount() throws Exception {
        TestUser user = registerUser();
        for (int i = 0; i < 4; i++) changePassword(user, "wrong-" + i).andExpect(status().isForbidden());
        changePassword(user, PASSWORD).andExpect(status().is2xxSuccessful());
        assertEquals(0, count(user));
        // Had the earlier four still counted, the second wrong guess here would already be 429.
        for (int i = 0; i < 4; i++) changePassword(user, "wrong-again-" + i).andExpect(status().isForbidden());
        assertEquals(4, count(user));
    }

    @Test
    @DisplayName("each account has its own count")
    void perAccount() throws Exception {
        TestUser first = registerUser();
        TestUser second = registerUser();
        for (int i = 0; i < 5; i++) changePassword(first, "wrong-" + i).andExpect(status().isForbidden());
        changePassword(first, PASSWORD).andExpect(status().isTooManyRequests());
        changePassword(second, PASSWORD).andExpect(status().is2xxSuccessful());
    }

    @Test
    @DisplayName("a Google-only account's wrong proofs count the same way")
    void googleOnlyAccountsAreThrottledToo() throws Exception {
        String sub = "sub-" + UUID.randomUUID();
        String email = uniqueEmail();
        Map<String, Object> signup = new LinkedHashMap<>();
        signup.put("credential", FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace"));
        signup.put("birthYear", 1990);
        signup.put("birthMonth", 5);
        signup.put("guardianAuthorized", false);
        signup.put("termsAccepted", true);
        signup.put("dataAuthorized", true);
        signup.put("legalVersion", LegalVersion.CURRENT);
        String signedUp = mockMvc.perform(post("/api/auth/google/complete").contentType(MediaType.APPLICATION_JSON).content(json(signup)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String bearer = "Bearer " + JsonPath.<String>read(signedUp, "$.token");
        long userId = ((Number) JsonPath.read(signedUp, "$.userId")).longValue();

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/users/me/delete").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("confirmation", "DELETE", "googleCredential", FakeGoogleTokenVerifier.credential("sub-other-" + i, email, true, "A", "B")))))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(post("/api/users/me/delete").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("confirmation", "DELETE", "googleCredential", FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace")))))
                .andExpect(status().isTooManyRequests());
        assertEquals(5, failures.countByUserIdAndFailedAtAfter(userId, LocalDateTime.now(ZoneOffset.UTC).minusDays(2)));
    }

    @Test
    @DisplayName("deleting the account removes its failure rows; the rows hold only the account number and a time")
    void erasedWithTheAccountAndNothingElseStored() throws Exception {
        TestUser user = registerUser();
        for (int i = 0; i < 3; i++) delete(user, "wrong-" + i).andExpect(status().isForbidden());
        assertEquals(3, count(user));
        assertEquals(List.of("id", "userId", "failedAt"),
                java.util.Arrays.stream(ReauthFailure.class.getDeclaredFields()).map(java.lang.reflect.Field::getName).toList());

        deleteOwnAccount(user);

        assertEquals(0, count(user));
    }

    @Test
    @DisplayName("a lock-out is logged with the account number only, and no password reaches the logs")
    void lockoutIsLoggedWithoutSecrets() throws Exception {
        Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        ListAppender<ILoggingEvent> logs = new ListAppender<>();
        logs.start();
        root.addAppender(logs);
        try {
            TestUser user = registerUser();
            for (int i = 0; i < 5; i++) delete(user, "secret-guess-" + i).andExpect(status().isForbidden());
            delete(user, PASSWORD).andExpect(status().isTooManyRequests());

            List<String> lines = logs.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
            assertTrue(lines.stream().anyMatch(m -> m.contains("Too many wrong re-authentication attempts for user id " + user.userId())));
            for (String line : lines) {
                assertFalse(line.contains("secret-guess"), line);
                assertFalse(line.contains(PASSWORD), line);
                assertFalse(line.contains(user.email()), line);
            }
        } finally {
            root.detachAppender(logs);
        }
    }
}
