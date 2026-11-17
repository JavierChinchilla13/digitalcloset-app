package com.javier.closetapp.integration;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit H12: the counter of age refusals, switched ON here (it is off by default): after 2 refusals from one address the
// answer is 429, for adults too, until the window passes. The default-off behaviour is covered in RegistrationAgeIntegrationTest
// and AgeRejectionLimiterTest (many refusals in a row never block).
@TestPropertySource(properties = {
        "app.rate-limit.age-rejection.enabled=true",
        "app.rate-limit.age-rejection.max=2"
})
class AgeRejectionLimitIntegrationTest extends IntegrationTestBase {

    private ResultActions register(int monthsAgo, boolean guardian) throws Exception {
        LocalDate d = LocalDate.now(ZoneOffset.UTC).minusMonths(monthsAgo);
        Map<String, Object> body = new LinkedHashMap<>(registrationBody(uniqueEmail(), PASSWORD));
        body.put("birthYear", d.getYear());
        body.put("birthMonth", d.getMonthValue());
        body.put("guardianAuthorized", guardian);
        return mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    @Test
    @DisplayName("after the maximum number of age refusals the same address gets a 429, even for an adult")
    void blocksAfterTwoRefusals() throws Exception {
        register(9 * 12, false).andExpect(status().isForbidden());
        register(10 * 12, false).andExpect(status().isForbidden());

        register(9 * 12, false).andExpect(status().isTooManyRequests());
        register(30 * 12, false).andExpect(status().isTooManyRequests());
    }
}
