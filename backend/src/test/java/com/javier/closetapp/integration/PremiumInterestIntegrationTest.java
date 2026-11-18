package com.javier.closetapp.integration;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.javier.closetapp.auth.mail.MailTransport;
import com.javier.closetapp.backup.BackupTables;
import com.javier.closetapp.billing.PremiumInterestMailer;
import com.javier.closetapp.billing.PremiumInterestRepository;
import com.javier.closetapp.billing.TemplatedPremiumInterestMailer;
import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.support.FakeStripeGateway;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// "Request Premium" while Stripe is off: who may ask, that it is idempotent and limited, that a failing email never loses the request, that
// the row goes with the account and appears in "download my data", and that no personal data reaches the email or the logs.
class PremiumInterestIntegrationTest extends IntegrationTestBase {

    @Autowired private FakeStripeGateway stripe;
    @Autowired private PremiumInterestRepository interest;
    @MockBean private PremiumInterestMailer mailer;

    @BeforeEach
    void billingIsOff() {
        stripe.configured = false;
    }

    @AfterEach
    void billingBack() {
        stripe.reset();
    }

    private ResultActions request(TestUser user) throws Exception {
        return mockMvc.perform(post("/api/billing/premium-interest").header("Authorization", user.bearer()));
    }

    private ResultActions state(TestUser user) throws Exception {
        return mockMvc.perform(get("/api/billing/premium-interest").header("Authorization", user.bearer()));
    }

    private TestUser registerAged(int years, boolean guardian) throws Exception {
        String email = uniqueEmail();
        LocalDate born = LocalDate.now(ZoneOffset.UTC).minusYears(years).minusMonths(2);
        String body = mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json(withFields(registrationBody(email, PASSWORD),
                                Map.of("birthYear", born.getYear(), "birthMonth", born.getMonthValue(), "guardianAuthorized", guardian)))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new TestUser(((Number) JsonPath.read(body, "$.userId")).longValue(), email, JsonPath.read(body, "$.token"));
    }

    // --- who may ask ---

    @Test
    @DisplayName("a declared adult with confirmed details can request: 200, 'requested' with a date; the status read agrees")
    void adultCanRequest() throws Exception {
        TestUser user = registerUser();
        state(user).andExpect(status().isOk()).andExpect(jsonPath("$.requested").value(false)).andExpect(jsonPath("$.requestedAt").value((Object) null));

        request(user).andExpect(status().isOk()).andExpect(jsonPath("$.requested").value(true)).andExpect(jsonPath("$.requestedAt").isNotEmpty());

        state(user).andExpect(jsonPath("$.requested").value(true));
        assertTrue(interest.findByUserId(user.userId()).isPresent());
    }

    @Test
    @DisplayName("someone aged 13-17 gets 403 and nothing is stored")
    void minorIsRefused() throws Exception {
        TestUser teen = registerAged(15, true);
        request(teen).andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("Premium is available to people who are 18 or older."));
        assertTrue(interest.findByUserId(teen.userId()).isEmpty());
        verify(mailer, never()).notifyNewRequest(eq(teen.userId()), anyLong());
    }

    @Test
    @DisplayName("an account that has not confirmed its details (no birth date) gets 403")
    void unconfirmedIsRefused() throws Exception {
        TestUser user = registerUser();
        User entity = userRepository.findByEmail(user.email()).orElseThrow();
        entity.setBirthYear(null);
        entity.setBirthMonth(null);
        userRepository.save(entity);

        request(user).andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("Please confirm your details first."));
        assertTrue(interest.findByUserId(user.userId()).isEmpty());
    }

    @Test
    @DisplayName("no token = 401 on every endpoint; the admin count is 403 for an ordinary user")
    void permissions() throws Exception {
        mockMvc.perform(post("/api/billing/premium-interest")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/billing/premium-interest")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/premium-interest")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/premium-interest").header("Authorization", registerUser().bearer())).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("when Stripe IS configured, requesting is refused (the Upgrade flow is used instead) and nothing is stored")
    void refusedWhenBillingIsOn() throws Exception {
        stripe.configured = true;
        TestUser user = registerUser();
        request(user).andExpect(status().isBadRequest());
        assertTrue(interest.findByUserId(user.userId()).isEmpty());
    }

    @Test
    @DisplayName("an admin or an account that already has Premium is refused (400): they have nothing to ask for")
    void adminAndPremiumAreRefused() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        request(admin).andExpect(status().isBadRequest());

        TestUser premium = registerUser();
        setPlan(premium, Plan.PREMIUM);
        request(premium).andExpect(status().isBadRequest());
    }

    // --- idempotent, limited ---

    @Test
    @DisplayName("a second request answers 'requested' again with the same date, stores one row and sends one email")
    void idempotent() throws Exception {
        TestUser user = registerUser();
        String first = request(user).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String second = request(user).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertEquals(JsonPath.<String>read(first, "$.requestedAt"), JsonPath.<String>read(second, "$.requestedAt"));
        assertEquals(1, interest.findAll().stream().filter(r -> r.getUserId().equals(user.userId())).count());
        verify(mailer, times(1)).notifyNewRequest(eq(user.userId()), anyLong());
    }

    @Test
    @DisplayName("more than 10 calls a minute from one account are 429 (each account has its own allowance)")
    void rateLimited() throws Exception {
        TestUser user = registerUser();
        for (int i = 0; i < 10; i++) request(user).andExpect(status().isOk());
        request(user).andExpect(status().isTooManyRequests());
        request(registerUser()).andExpect(status().isOk());
    }

    // --- the email ---

    @Test
    @DisplayName("the owner is told with the user id and the running total: no email, name or password is passed to the mailer")
    void mailerGetsOnlyTheIdAndTheTotal() throws Exception {
        long before = interest.count();
        TestUser user = registerUser();
        request(user).andExpect(status().isOk());
        verify(mailer).notifyNewRequest(user.userId(), before + 1);
    }

    @Test
    @DisplayName("if the notification email fails, the request is still saved and the person still sees 'Requested'")
    void mailFailureStillSaves() throws Exception {
        doThrow(new RuntimeException("relay down for someone@example.com")).when(mailer).notifyNewRequest(anyLong(), anyLong());
        TestUser user = registerUser();

        request(user).andExpect(status().isOk()).andExpect(jsonPath("$.requested").value(true));

        assertTrue(interest.findByUserId(user.userId()).isPresent());
        state(user).andExpect(jsonPath("$.requested").value(true));
    }

    @Test
    @DisplayName("the real mailer sends to the contact address with the subject 'New Premium request' and only the total in the body")
    void templatedMailerContent() {
        List<String[]> sent = new ArrayList<>();
        MailTransport transport = (to, replyTo, subject, text, html) -> sent.add(new String[] {to, replyTo, subject, text, html});
        new TemplatedPremiumInterestMailer(transport, "owner@example.com").notifyNewRequest(42, 17);

        assertEquals(1, sent.size());
        assertEquals("owner@example.com", sent.get(0)[0]);
        assertEquals("New Premium request", sent.get(0)[2]);
        assertTrue(sent.get(0)[3].contains("Total requests so far: 17"));
        assertTrue(sent.get(0)[4].contains("17"));
        // Only the total: no account number, no address.
        assertFalse(sent.get(0)[3].contains("42"));
        assertFalse(sent.get(0)[3].contains("@"));
    }

    // --- the data ---

    @Test
    @DisplayName("deleting the account deletes the row; other people's rows stay")
    void erasedWithTheAccount() throws Exception {
        TestUser leaving = registerUser();
        TestUser staying = registerUser();
        request(leaving).andExpect(status().isOk());
        request(staying).andExpect(status().isOk());

        deleteOwnAccount(leaving);

        assertTrue(interest.findByUserId(leaving.userId()).isEmpty());
        assertTrue(interest.findByUserId(staying.userId()).isPresent());
    }

    @Test
    @DisplayName("the 30-day purge of deactivated accounts also removes it (it uses the same erasure)")
    void purgeUsesTheSameErasure() throws Exception {
        TestUser user = registerUser();
        request(user).andExpect(status().isOk());
        deactivateAsAdmin(user);
        User entity = userRepository.findByEmail(user.email()).orElseThrow();
        entity.setDeactivatedAt(java.time.LocalDateTime.now(ZoneOffset.UTC).minusDays(45));
        userRepository.save(entity);
        TestUser admin = registerUser();
        promoteToAdmin(admin);

        mockMvc.perform(post("/api/users/purge-deactivated?dryRun=false").header("Authorization", admin.bearer())).andExpect(status().isOk());

        assertTrue(userRepository.findByEmail(user.email()).isEmpty());
        assertTrue(interest.findByUserId(user.userId()).isEmpty());
    }

    @Test
    @DisplayName("'download my data' says whether this account requested Premium, and when")
    void exportIncludesIt() throws Exception {
        TestUser asked = registerUser();
        TestUser didNot = registerUser();
        request(asked).andExpect(status().isOk());

        mockMvc.perform(get("/api/users/me/export").header("Authorization", asked.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.premiumRequest.requested").value(true))
                .andExpect(jsonPath("$.premiumRequest.requestedAt").isNotEmpty());
        mockMvc.perform(get("/api/users/me/export").header("Authorization", didNot.bearer()))
                .andExpect(jsonPath("$.premiumRequest.requested").value(false))
                .andExpect(jsonPath("$.premiumRequest.requestedAt").value((Object) null));
    }

    @Test
    @DisplayName("the table is part of the backup (user data, not a secret), not in the excluded list")
    void backupDecision() {
        assertTrue(BackupTables.INCLUDED.contains("premium_interest"));
        assertFalse(BackupTables.EXCLUDED.contains("premium_interest"));
    }

    // --- the admin number ---

    @Test
    @DisplayName("the admin sees only a count and the date of the latest request: no account is identified")
    void adminSummary() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        long before = interest.count();
        TestUser user = registerUser();
        request(user).andExpect(status().isOk());

        String body = mockMvc.perform(get("/api/admin/premium-interest").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(before + 1))
                .andExpect(jsonPath("$.latestAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains(user.email()));
        assertEquals(List.of("count", "latestAt"), new ArrayList<>(JsonPath.<Map<String, Object>>read(body, "$").keySet()));
    }

    // --- logs ---

    @Test
    @DisplayName("nothing personal reaches the logs: only the account number (also when the email fails)")
    void noPersonalDataInLogs() throws Exception {
        Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        ListAppender<ILoggingEvent> logs = new ListAppender<>();
        logs.start();
        root.addAppender(logs);
        try {
            TestUser ok = registerUser();
            TestUser failing = registerUser();
            request(ok).andExpect(status().isOk());
            doThrow(new RuntimeException("relay down for " + failing.email())).when(mailer).notifyNewRequest(anyLong(), anyLong());
            request(failing).andExpect(status().isOk());

            List<String> lines = logs.list.stream()
                    .map(e -> e.getFormattedMessage() + (e.getThrowableProxy() == null ? "" : " " + e.getThrowableProxy().getMessage())).toList();
            assertTrue(lines.stream().anyMatch(m -> m.contains("could not be sent for user id " + failing.userId())));
            for (String line : lines) {
                for (String secret : new String[] {ok.email(), failing.email(), PASSWORD, ok.token(), failing.token()}) {
                    assertFalse(line.contains(secret), "a log line contains personal data: " + line);
                }
            }
        } finally {
            root.detachAppender(logs);
            Mockito.reset(mailer);
        }
    }
}
