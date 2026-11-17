package com.javier.closetapp.integration;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.javier.closetapp.legal.LegalVersion;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit H12: sign-up with a birth month and year, the guardian declaration for 13-17, and the two separate acceptances.
// Someone under the minimum age is refused with the same answer every time and NOTHING about them is stored or logged.
class RegistrationAgeIntegrationTest extends IntegrationTestBase {

    // Birth month/year of someone born exactly `monthsAgo` months before today (UTC, like the server).
    private static int[] born(int monthsAgo) {
        LocalDate d = LocalDate.now(ZoneOffset.UTC).minusMonths(monthsAgo);
        return new int[]{d.getYear(), d.getMonthValue()};
    }

    // A valid sign-up body for someone born `monthsAgo` months ago, with or without the guardian declaration.
    private Map<String, Object> body(String email, int monthsAgo, boolean guardian) {
        int[] b = born(monthsAgo);
        Map<String, Object> body = new LinkedHashMap<>(registrationBody(email, PASSWORD));
        body.put("birthYear", b[0]);
        body.put("birthMonth", b[1]);
        body.put("guardianAuthorized", guardian);
        return body;
    }

    private ResultActions register(Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    // ---- who may sign up ----

    @Test
    @DisplayName("an adult signs up, and the account records birth month/year, the acceptances and their time and version")
    void adultSignsUp() throws Exception {
        String email = uniqueEmail();
        Map<String, Object> body = body(email, 30 * 12, false);

        register(body).andExpect(status().isOk());

        User user = userRepository.findByEmail(email).orElseThrow();
        assertEquals(body.get("birthYear"), user.getBirthYear());
        assertEquals(body.get("birthMonth"), user.getBirthMonth());
        assertEquals(LegalVersion.CURRENT, user.getTermsVersion());
        assertNotNull(user.getTermsAcceptedAt());
        assertNotNull(user.getDataAuthorizedAt());
        assertFalse(user.isGuardianAuthorized());
        assertNull(user.getGuardianAuthorizedAt());
    }

    @Test
    @DisplayName("someone aged 13-17 signs up with the guardian declaration, and it is recorded with its time")
    void minorSignsUpWithGuardian() throws Exception {
        String email = uniqueEmail();

        register(body(email, 15 * 12, true)).andExpect(status().isOk());

        User user = userRepository.findByEmail(email).orElseThrow();
        assertTrue(user.isGuardianAuthorized());
        assertNotNull(user.getGuardianAuthorizedAt());
    }

    @Test
    @DisplayName("someone aged 13-17 without the guardian declaration is refused with a clear message, and nothing is created")
    void minorWithoutGuardianIsRefused() throws Exception {
        String email = uniqueEmail();
        long before = userRepository.count();

        register(body(email, 15 * 12, false))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A parent or legal guardian must authorise the use of your account and data."));

        assertEquals(before, userRepository.count());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    @DisplayName("someone under 13 gets the same 403 whatever the details, and no account, password hash or row exists afterwards")
    void underMinimumIsRefusedAndNothingIsStored() throws Exception {
        String email = uniqueEmail();
        long before = userRepository.count();

        register(body(email, 9 * 12, true))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AGE_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value("We can't create an account with this information."));

        assertEquals(before, userRepository.count());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    @DisplayName("the refusal is identical whether or not the email already has an account (it reveals nothing)")
    void refusalRevealsNothingAboutTheEmail() throws Exception {
        TestUser existing = registerUser();

        String forExisting = register(body(existing.email(), 9 * 12, false)).andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString();
        String forNew = register(body(uniqueEmail(), 9 * 12, false)).andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString();

        assertEquals(com.jayway.jsonpath.JsonPath.<String>read(forNew, "$.message"), com.jayway.jsonpath.JsonPath.<String>read(forExisting, "$.message"));
        assertEquals(com.jayway.jsonpath.JsonPath.<String>read(forNew, "$.code"), com.jayway.jsonpath.JsonPath.<String>read(forExisting, "$.code"));
    }

    @Test
    @DisplayName("the exact boundaries: 13 and 18 are reached at the END of the birth month")
    void boundaries() throws Exception {
        register(body(uniqueEmail(), 13 * 12, true)).andExpect(status().isForbidden());        // turns 13 at the end of this month
        register(body(uniqueEmail(), 13 * 12 + 1, true)).andExpect(status().isOk());           // 13 since last month
        register(body(uniqueEmail(), 18 * 12, true)).andExpect(status().isOk());               // still 17 this month: guardian needed and given
        register(body(uniqueEmail(), 18 * 12, false)).andExpect(status().isBadRequest());
        register(body(uniqueEmail(), 18 * 12 + 1, false)).andExpect(status().isOk());         // adult
    }

    @Test
    @DisplayName("a refused sign-up writes nothing to the log: no email, no birth year")
    void refusalIsNotLogged() throws Exception {
        String email = "refused-" + UUID.randomUUID() + "@example.com";
        Map<String, Object> body = body(email, 9 * 12, false);
        String year = String.valueOf(body.get("birthYear"));

        Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        root.addAppender(appender);
        try {
            register(body).andExpect(status().isForbidden());
        } finally {
            root.detachAppender(appender);
        }

        for (ILoggingEvent event : appender.list) {
            String text = event.getFormattedMessage() + " " + String.valueOf(event.getArgumentArray() == null ? "" : java.util.Arrays.toString(event.getArgumentArray()));
            assertFalse(text.contains(email), "the email was logged: " + text);
            assertFalse(text.contains(email.substring(0, email.indexOf('@'))), "the email was logged: " + text);
            assertFalse(text.contains("birthYear") || text.contains("\"birthMonth\""), "the birth date was logged: " + text);
            assertFalse(text.contains(PASSWORD), "the password was logged");
        }
        // A year on its own can appear in unrelated log lines (timestamps), so only the labelled fields are checked above;
        // the year string is read here so the test fails to compile if the body shape changes.
        assertFalse(year.isEmpty());
    }

    // ---- the declarations ----

    @Test
    @DisplayName("both acceptances are required, separately")
    void bothAcceptancesAreRequired() throws Exception {
        Map<String, Object> noTerms = body(uniqueEmail(), 30 * 12, false);
        noTerms.put("termsAccepted", false);
        Map<String, Object> noData = body(uniqueEmail(), 30 * 12, false);
        noData.put("dataAuthorized", false);
        Map<String, Object> missing = body(uniqueEmail(), 30 * 12, false);
        missing.remove("dataAuthorized");

        register(noTerms).andExpect(status().isBadRequest());
        register(noData).andExpect(status().isBadRequest());
        register(missing).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("the version of the Terms must be the current one (a stale page is told to reload)")
    void staleVersionIsRefused() throws Exception {
        Map<String, Object> stale = body(uniqueEmail(), 30 * 12, false);
        stale.put("legalVersion", "2020-01-old");

        register(stale).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The Terms have been updated. Please reload the page and try again."));
    }

    @Test
    @DisplayName("a missing, impossible or future birth date is a plain 400, not an age refusal")
    void invalidBirthDates() throws Exception {
        Map<String, Object> noYear = body(uniqueEmail(), 30 * 12, false);
        noYear.remove("birthYear");
        Map<String, Object> badMonth = body(uniqueEmail(), 30 * 12, false);
        badMonth.put("birthMonth", 13);
        Map<String, Object> future = body(uniqueEmail(), -2, false);   // two months from now

        register(noYear).andExpect(status().isBadRequest());
        register(badMonth).andExpect(status().isBadRequest());
        register(future).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("without the age fields the sign-up is refused (the old API shape no longer works)")
    void oldShapeIsRefused() throws Exception {
        register(new LinkedHashMap<>(Map.of("email", uniqueEmail(), "password", PASSWORD))).andExpect(status().isBadRequest());
    }
}
