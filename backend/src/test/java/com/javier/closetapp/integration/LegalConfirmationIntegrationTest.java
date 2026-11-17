package com.javier.closetapp.integration;

import com.javier.closetapp.clothing.repository.ClothingRepository;
import com.javier.closetapp.legal.LegalVersion;
import com.javier.closetapp.support.FakeStripeGateway;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit H12: accounts made BEFORE age and acceptance were asked are held on one step at their next sign-in (GET /users/me says
// needsLegalConfirmation); POST /users/me/legal records the facts. Under 13 erases the account. Premium is for declared adults only.
class LegalConfirmationIntegrationTest extends IntegrationTestBase {

    @Autowired private FakeStripeGateway stripe;
    @Autowired private ClothingRepository clothingRepository;

    @BeforeEach
    void resetFake() {
        stripe.reset();
    }

    // Makes an account look like one created before these facts were asked.
    private void makeOld(TestUser user) {
        User entity = userRepository.findByEmail(user.email()).orElseThrow();
        entity.setBirthYear(null);
        entity.setBirthMonth(null);
        entity.setGuardianAuthorized(false);
        entity.setGuardianAuthorizedAt(null);
        entity.setTermsVersion(null);
        entity.setTermsAcceptedAt(null);
        entity.setDataAuthorizedAt(null);
        userRepository.save(entity);
    }

    private Map<String, Object> confirmBody(int monthsAgo, boolean guardian) {
        LocalDate d = LocalDate.now(ZoneOffset.UTC).minusMonths(monthsAgo);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("birthYear", d.getYear());
        body.put("birthMonth", d.getMonthValue());
        body.put("guardianAuthorized", guardian);
        body.put("termsAccepted", true);
        body.put("dataAuthorized", true);
        body.put("legalVersion", LegalVersion.CURRENT);
        return body;
    }

    private ResultActions confirm(TestUser user, Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/api/users/me/legal").header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    private ResultActions me(TestUser user) throws Exception {
        return mockMvc.perform(get("/api/users/me").header("Authorization", user.bearer()));
    }

    // ---- who is held on the step ----

    @Test
    @DisplayName("a new sign-up does not need the step; an account without the recorded facts does")
    void legalStatusInMe() throws Exception {
        TestUser fresh = registerUser();
        me(fresh).andExpect(status().isOk()).andExpect(jsonPath("$.needsLegalConfirmation").value(false)).andExpect(jsonPath("$.ageBand").value("ADULT"));

        TestUser old = registerUser();
        makeOld(old);
        me(old).andExpect(status().isOk()).andExpect(jsonPath("$.needsLegalConfirmation").value(true)).andExpect(jsonPath("$.ageBand").doesNotExist());
    }

    @Test
    @DisplayName("an account created by an admin (no birth data) is held on the step too")
    void adminCreatedAccountNeedsIt() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        String email = uniqueEmail();
        mockMvc.perform(post("/api/users").header("Authorization", admin.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", PASSWORD, "role", "ROLE_USER"))))
                .andExpect(status().is2xxSuccessful());
        String token = objectMapper.readTree(login(email, PASSWORD).andReturn().getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.needsLegalConfirmation").value(true));
    }

    @Test
    @DisplayName("when the texts change (a different version was accepted) the step is needed again, without asking for the birth date")
    void staleVersionNeedsAcceptanceAgain() throws Exception {
        TestUser user = registerUser();
        User entity = userRepository.findByEmail(user.email()).orElseThrow();
        entity.setTermsVersion("2020-01-old");
        userRepository.save(entity);
        me(user).andExpect(jsonPath("$.needsLegalConfirmation").value(true));

        Map<String, Object> onlyAcceptances = new LinkedHashMap<>();
        onlyAcceptances.put("termsAccepted", true);
        onlyAcceptances.put("dataAuthorized", true);
        onlyAcceptances.put("legalVersion", LegalVersion.CURRENT);
        confirm(user, onlyAcceptances).andExpect(status().isOk()).andExpect(jsonPath("$.needsLegalConfirmation").value(false));

        assertEquals(LegalVersion.CURRENT, userRepository.findByEmail(user.email()).orElseThrow().getTermsVersion());
        assertEquals(1990, userRepository.findByEmail(user.email()).orElseThrow().getBirthYear());
    }

    // ---- completing the step ----

    @Test
    @DisplayName("an old account that is an adult records its facts, and is then released")
    void adultCompletes() throws Exception {
        TestUser user = registerUser();
        makeOld(user);

        confirm(user, confirmBody(30 * 12, false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.needsLegalConfirmation").value(false))
                .andExpect(jsonPath("$.ageBand").value("ADULT"));

        User saved = userRepository.findByEmail(user.email()).orElseThrow();
        assertNotNull(saved.getBirthYear());
        assertEquals(LegalVersion.CURRENT, saved.getTermsVersion());
        assertNotNull(saved.getTermsAcceptedAt());
        assertNotNull(saved.getDataAuthorizedAt());
    }

    @Test
    @DisplayName("an old account aged 13-17 needs the guardian declaration; the age band shows MINOR")
    void minorNeedsGuardian() throws Exception {
        TestUser user = registerUser();
        makeOld(user);

        confirm(user, confirmBody(15 * 12, false)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A parent or legal guardian must authorise the use of your account and data."));
        me(user).andExpect(jsonPath("$.needsLegalConfirmation").value(true));

        confirm(user, confirmBody(15 * 12, true)).andExpect(status().isOk())
                .andExpect(jsonPath("$.needsLegalConfirmation").value(false))
                .andExpect(jsonPath("$.ageBand").value("MINOR"));
        assertTrue(userRepository.findByEmail(user.email()).orElseThrow().isGuardianAuthorized());
    }

    @Test
    @DisplayName("both acceptances and the current version are required; a missing or impossible birth date is a plain 400")
    void declarationsAreRequired() throws Exception {
        TestUser user = registerUser();
        makeOld(user);
        Map<String, Object> noTerms = confirmBody(30 * 12, false);
        noTerms.put("termsAccepted", false);
        Map<String, Object> stale = confirmBody(30 * 12, false);
        stale.put("legalVersion", "2020-01-old");
        Map<String, Object> noDate = confirmBody(30 * 12, false);
        noDate.remove("birthYear");

        confirm(user, noTerms).andExpect(status().isBadRequest());
        confirm(user, stale).andExpect(status().isBadRequest());
        confirm(user, noDate).andExpect(status().isBadRequest());
        me(user).andExpect(jsonPath("$.needsLegalConfirmation").value(true));
    }

    @Test
    @DisplayName("a birth date that is already recorded cannot be changed from this step")
    void recordedBirthDateIsNotChanged() throws Exception {
        TestUser user = registerUser();   // born May 1990
        User entity = userRepository.findByEmail(user.email()).orElseThrow();
        entity.setTermsVersion("2020-01-old");
        userRepository.save(entity);

        // Sending a recent date (which would be under the minimum) changes nothing: the recorded one is used.
        confirm(user, confirmBody(5 * 12, true)).andExpect(status().isOk());

        User saved = userRepository.findByEmail(user.email()).orElseThrow();
        assertEquals(1990, saved.getBirthYear());
        assertEquals(5, saved.getBirthMonth());
    }

    // ---- under the minimum age ----

    @Test
    @DisplayName("an old account that declares an age under 13 is ERASED with all its data, gets the uniform 403, and others are untouched")
    void underMinimumIsErased() throws Exception {
        TestUser bob = registerUser();
        createItem(bob, "bob-shirt", "TOP");
        long garments = clothingRepository.count();

        TestUser child = registerUser();
        createItem(child, "child-shirt", "TOP");
        long outfit = createOutfit(child, "look", createItem(child, "child-pants", "BOTTOM"));
        assertTrue(outfit > 0);
        makeOld(child);

        confirm(child, confirmBody(9 * 12, true))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AGE_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value("We can't create an account with this information."));

        assertTrue(userRepository.findByEmail(child.email()).isEmpty(), "the account must be gone");
        assertEquals(garments, clothingRepository.count(), "its garments must be gone");
        mockMvc.perform(get("/api/clothing").header("Authorization", child.bearer())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/clothing").header("Authorization", bob.bearer())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("the step needs a signed-in person")
    void needsSignIn() throws Exception {
        mockMvc.perform(post("/api/users/me/legal").contentType(MediaType.APPLICATION_JSON).content(json(confirmBody(30 * 12, false))))
                .andExpect(status().isUnauthorized());
    }

    // ---- Premium only for declared adults ----

    @Test
    @DisplayName("Premium checkout works for a declared adult, and is refused for a declared minor and for an account that has not confirmed its details")
    void premiumIsForAdults() throws Exception {
        TestUser adult = registerUser();
        mockMvc.perform(post("/api/billing/checkout").header("Authorization", adult.bearer())).andExpect(status().isOk());

        // A 15-year-old who signed up with the guardian declaration.
        LocalDate d = LocalDate.now(ZoneOffset.UTC).minusMonths(15 * 12);
        String email = uniqueEmail();
        Map<String, Object> minorBody = new LinkedHashMap<>(registrationBody(email, PASSWORD));
        minorBody.put("birthYear", d.getYear());
        minorBody.put("birthMonth", d.getMonthValue());
        minorBody.put("guardianAuthorized", true);
        String token = objectMapper.readTree(mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(minorBody)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();
        mockMvc.perform(post("/api/billing/checkout").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Premium is available to people who are 18 or older."));

        TestUser old = registerUser();
        makeOld(old);
        mockMvc.perform(post("/api/billing/checkout").header("Authorization", old.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please confirm your details before subscribing."));
        // Only the adult's checkout reached Stripe (it created one customer); the other two were refused before.
        assertEquals(1, stripe.createdCustomers.size());
    }
}
