package com.javier.closetapp.integration;

import com.javier.closetapp.account.ImageErasureQueueEntry;
import com.javier.closetapp.account.ImageErasureQueueRepository;
import com.javier.closetapp.clothing.repository.ClothingRepository;
import com.javier.closetapp.collection.repository.CollectionRepository;
import com.javier.closetapp.legal.LegalVersion;
import com.javier.closetapp.outfit.repository.OutfitRepository;
import com.javier.closetapp.persona.repository.PersonaDisplayNameRepository;
import com.javier.closetapp.support.FakeGoogleTokenVerifier;
import com.javier.closetapp.support.IntegrationTestBase;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Audit H12: "delete my account and data" is REAL erasure (not deactivation): every row of the person goes, nothing of anyone else is
// touched, the picture addresses are queued for the owner's purge script (with no link to the person), and "download my data" exports
// only the person's own data.
class AccountDeletionIntegrationTest extends IntegrationTestBase {

    @Autowired private ClothingRepository clothingRepository;
    @Autowired private OutfitRepository outfitRepository;
    @Autowired private CollectionRepository collectionRepository;
    @Autowired private PersonaDisplayNameRepository personaRepository;
    @Autowired private ImageErasureQueueRepository imageQueue;

    private long createCollection(TestUser user, String name) throws Exception {
        String body = mockMvc.perform(post("/api/collections").header("Authorization", user.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("name", name))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.collectionId")).longValue();
    }

    // Gives a person a full set of data: garments (one already deleted), an outfit that is their main one and shared, a category
    // holding that outfit and a garment, and a persona name. Returns the outfit's share token.
    private String fill(TestUser user, String tag) throws Exception {
        long shirt = createItem(user, tag + "-shirt", "TOP");
        long pants = createItem(user, tag + "-pants", "BOTTOM");
        long gone = createItem(user, tag + "-gone", "TOP");
        mockMvc.perform(delete("/api/clothing/" + gone).header("Authorization", user.bearer())).andExpect(status().is2xxSuccessful());
        long outfit = createOutfit(user, tag + "-look", shirt, pants);   // the first outfit becomes the main one
        long collection = createCollection(user, tag + "-cat");
        mockMvc.perform(post("/api/collections/" + collection + "/outfits/" + outfit).header("Authorization", user.bearer())).andExpect(status().isOk());
        mockMvc.perform(post("/api/collections/" + collection + "/items/" + shirt).header("Authorization", user.bearer())).andExpect(status().isOk());
        mockMvc.perform(put("/api/persona-display-names/MALE").header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("displayName", tag + "-name")))).andExpect(status().isOk());
        String shared = mockMvc.perform(post("/api/outfits/" + outfit + "/share").header("Authorization", user.bearer()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(shared, "$.shareToken");
    }

    @Test
    @DisplayName("deleting an account erases every row of the person, ends the session, frees the email, and touches nobody else")
    void erasesEverythingAndOnlyTheirs() throws Exception {
        TestUser bob = registerUser();
        fill(bob, "bob");
        long garments = clothingRepository.count();
        long outfits = outfitRepository.count();
        long categories = collectionRepository.count();
        long names = personaRepository.count();

        TestUser alice = registerUser();
        String token = fill(alice, "alice");
        mockMvc.perform(get("/api/public/outfits/" + token)).andExpect(status().isOk());

        deleteOwnAccount(alice);

        assertTrue(userRepository.findByEmail(alice.email()).isEmpty());
        assertEquals(garments, clothingRepository.count(), "alice's garments, including the deleted one, must be gone");
        assertEquals(outfits, outfitRepository.count());
        assertEquals(categories, collectionRepository.count());
        assertEquals(names, personaRepository.count());
        mockMvc.perform(get("/api/clothing").header("Authorization", alice.bearer())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/public/outfits/" + token)).andExpect(status().isNotFound());
        login(alice.email(), PASSWORD).andExpect(status().isUnauthorized());

        // Bob is untouched.
        mockMvc.perform(get("/api/clothing").header("Authorization", bob.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get("/api/outfits").header("Authorization", bob.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));

        // The email is free again.
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json(registrationBody(alice.email(), PASSWORD))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("without the word DELETE or with a wrong password nothing is deleted")
    void needsTheConfirmationAndTheProof() throws Exception {
        TestUser user = registerUser();
        createItem(user, "keep-me", "TOP");

        mockMvc.perform(post("/api/users/me/delete").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("confirmation", "delete", "password", PASSWORD))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/users/me/delete").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("confirmation", "DELETE", "password", "not-the-password"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));
        mockMvc.perform(post("/api/users/me/delete").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("confirmation", "DELETE"))))
                .andExpect(status().isForbidden());

        assertTrue(userRepository.findByEmail(user.email()).isPresent());
        mockMvc.perform(get("/api/clothing").header("Authorization", user.bearer())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("a Google-only account confirms with a fresh credential for the SAME Google account")
    void googleOnlyAccountNeedsItsOwnGoogleProof() throws Exception {
        String sub = "sub-" + UUID.randomUUID();
        String email = uniqueEmail();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("credential", FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace"));
        body.put("birthYear", 1990);
        body.put("birthMonth", 5);
        body.put("guardianAuthorized", false);
        body.put("termsAccepted", true);
        body.put("dataAuthorized", true);
        body.put("legalVersion", LegalVersion.CURRENT);
        String signedUp = mockMvc.perform(post("/api/auth/google/complete").contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String bearer = "Bearer " + JsonPath.<String>read(signedUp, "$.token");

        // No proof, someone else's Google account, or garbage: refused, and the account stays.
        for (Map<String, Object> wrong : List.<Map<String, Object>>of(
                Map.of("confirmation", "DELETE"),
                Map.of("confirmation", "DELETE", "googleCredential", FakeGoogleTokenVerifier.credential("sub-someone-else", email, true, "A", "B")),
                Map.of("confirmation", "DELETE", "googleCredential", "garbage"))) {
            mockMvc.perform(post("/api/users/me/delete").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(json(wrong)))
                    .andExpect(status().isForbidden());
        }
        assertTrue(userRepository.findByEmail(email).isPresent());

        mockMvc.perform(post("/api/users/me/delete").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("confirmation", "DELETE", "googleCredential", FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace")))))
                .andExpect(status().isNoContent());
        assertTrue(userRepository.findByEmail(email).isEmpty());
    }

    @Test
    @DisplayName("the person's Cloudinary pictures (garments, deleted garments and jacket parts) are queued once, with no link to the person; other addresses are not")
    void picturesAreQueuedForThePurgeScript() throws Exception {
        TestUser user = registerUser();
        String tag = UUID.randomUUID().toString().substring(0, 8);
        String plain = "https://res.cloudinary.com/test/image/upload/v1/" + tag + "-plain.png";
        String partA = "https://res.cloudinary.com/test/image/upload/v1/" + tag + "-partA.png";
        String partB = "https://res.cloudinary.com/test/image/upload/v1/" + tag + "-partB.png";
        String foreign = "https://evil.example/" + tag + ".png";
        String modular = "{\"segments\":{\"torso\":{\"imageUrl\":\"" + partA + "\"},\"collar\":{\"imageUrl\":\"" + partB
                + "\"},\"odd\":{\"imageUrl\":\"" + foreign + "\"}},\"isOpen\":false}";

        Map<String, Object> garment = new LinkedHashMap<>();
        garment.put("name", "Jacket");
        garment.put("category", "JACKET");
        garment.put("imageUrl", plain);
        garment.put("personaType", "MALE");
        garment.put("isModular", true);
        garment.put("modularData", modular);
        String created = mockMvc.perform(post("/api/clothing").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON).content(json(garment)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        // A garment the person already deleted still has its picture at the provider.
        long deleted = createItem(user, tag + "-deleted", "TOP");
        mockMvc.perform(delete("/api/clothing/" + deleted).header("Authorization", user.bearer())).andExpect(status().is2xxSuccessful());
        // A relative sample picture is not something to remove from Cloudinary.
        Map<String, Object> sample = new LinkedHashMap<>(garment);
        sample.put("imageUrl", "/samples/black-tee.png");
        sample.put("isModular", false);
        sample.remove("modularData");
        mockMvc.perform(post("/api/clothing").header("Authorization", user.bearer()).contentType(MediaType.APPLICATION_JSON).content(json(sample))).andExpect(status().isOk());
        assertTrue(JsonPath.<Number>read(created, "$.itemId").longValue() > 0);

        deleteOwnAccount(user);

        List<String> queued = imageQueue.findAll().stream().map(ImageErasureQueueEntry::getImageUrl).toList();
        assertTrue(queued.contains(plain));
        assertTrue(queued.contains(partA));
        assertTrue(queued.contains(partB));
        assertTrue(queued.contains("https://res.cloudinary.com/test/image/upload/" + tag + "-deleted.png"));
        assertFalse(queued.contains(foreign));
        assertFalse(queued.contains("/samples/black-tee.png"));
        assertEquals(1, queued.stream().filter(plain::equals).count());
    }

    @Test
    @DisplayName("the old self-deactivation endpoint is gone: a person can only delete their account")
    void selfDeactivationIsGone() throws Exception {
        TestUser user = registerUser();

        mockMvc.perform(patch("/api/users/me/deactivate").header("Authorization", user.bearer())).andExpect(status().is4xxClientError());

        assertTrue(userRepository.findByEmail(user.email()).orElseThrow().isActive());
    }

    @Test
    @DisplayName("download my data: the person's own data in one JSON file, without the password hash, tokens or payment ids; nobody else's data")
    void exportHoldsOnlyTheirOwnData() throws Exception {
        TestUser bob = registerUser();
        createItem(bob, "bob-secret-shirt", "TOP");
        TestUser alice = registerUser();
        fill(alice, "alice");

        String body = mockMvc.perform(get("/api/users/me/export").header("Authorization", alice.bearer()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
                .andExpect(jsonPath("$.profile.email").value(alice.email()))
                .andExpect(jsonPath("$.profile.birthYear").value(1990))
                .andExpect(jsonPath("$.profile.termsVersionAccepted").value(LegalVersion.CURRENT))
                .andExpect(jsonPath("$.garments.length()").value(2))
                .andExpect(jsonPath("$.outfits.length()").value(1))
                .andExpect(jsonPath("$.categories.length()").value(1))
                .andExpect(jsonPath("$.personaNames.length()").value(1))
                .andReturn().getResponse().getContentAsString();

        assertFalse(body.contains("bob-secret-shirt"));
        assertFalse(body.contains(bob.email()));
        assertFalse(body.toLowerCase().contains("password"));
        assertFalse(body.contains("stripe"));
        mockMvc.perform(get("/api/users/me/export")).andExpect(status().isUnauthorized());
    }
}
