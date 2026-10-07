package com.javier.closetapp.integration;

import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 96: how many garments an account may keep - 15 free, a premium limit (20 in the test profile,
// 300 in production), unlimited for admins - and who can change an account's plan.
class GarmentLimitIntegrationTest extends IntegrationTestBase {

    @Test
    @DisplayName("a free account holds 15 garments; the 16th is refused with GARMENT_LIMIT")
    void freeAccountStopsAtFifteen() throws Exception {
        TestUser user = registerUser();
        createItems(user, 15);

        postItem(user, "one-too-many")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("GARMENT_LIMIT"))
                .andExpect(jsonPath("$.limit").value(15))
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.message").value("Your free plan holds up to 15 garments. Delete a garment to add another."));
    }

    @Test
    @DisplayName("deleting a garment frees its slot")
    void deletedGarmentFreesItsSlot() throws Exception {
        TestUser user = registerUser();
        createItems(user, 14);
        long last = createItem(user, "the-15th", "TOP");
        postItem(user, "refused").andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/clothing/" + last).header("Authorization", user.bearer()))
                .andExpect(status().isNoContent());

        postItem(user, "fits-now").andExpect(status().isOk());
    }

    @Test
    @DisplayName("another account's garments do not count")
    void otherAccountsDoNotCount() throws Exception {
        TestUser full = registerUser();
        TestUser other = registerUser();
        createItems(full, 15);

        postItem(other, "mine").andExpect(status().isOk());
    }

    @Test
    @DisplayName("a premium account gets the premium limit, then is refused")
    void premiumHasMoreSpace() throws Exception {
        TestUser user = registerUser();
        setPlan(user, Plan.PREMIUM);
        createItems(user, 20); // the test profile's premium limit

        postItem(user, "over-premium")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.limit").value(20))
                .andExpect(jsonPath("$.plan").value("PREMIUM"))
                .andExpect(jsonPath("$.message").value("Your plan holds up to 20 garments. Delete a garment to add another."));
    }

    @Test
    @DisplayName("an admin has no limit")
    void adminIsUnlimited() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        createItems(admin, 25);

        postItem(admin, "still-fine").andExpect(status().isOk());
    }

    @Test
    @DisplayName("an account already over its limit keeps its garments; only new ones are refused")
    void overLimitAccountKeepsItsGarments() throws Exception {
        TestUser user = registerUser();
        setPlan(user, Plan.PREMIUM);
        createItems(user, 18);
        setPlan(user, Plan.FREE); // downgraded while holding 18

        mockMvc.perform(get("/api/clothing").header("Authorization", user.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(18));
        postItem(user, "new-one").andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("requests made at the same time cannot slip past the limit")
    void concurrentCreatesRespectTheLimit() throws Exception {
        TestUser user = registerUser();
        ExecutorService pool = Executors.newFixedThreadPool(12);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            final int n = i;
            Callable<Integer> call = () -> postItem(user, "race-" + n).andReturn().getResponse().getStatus();
            results.add(pool.submit(call));
        }
        int created = 0;
        int refused = 0;
        for (Future<Integer> result : results) {
            int code = result.get();
            if (code == 200) created++;
            else if (code == 403) refused++;
        }
        pool.shutdown();

        assertEquals(15, created, "exactly the limit gets through");
        assertEquals(9, refused);
    }

    @Test
    @DisplayName("/users/me reports the plan and the limit (null for an admin)")
    void meReportsPlanAndLimit() throws Exception {
        TestUser user = registerUser();
        mockMvc.perform(get("/api/users/me").header("Authorization", user.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.garmentLimit").value(15));

        setPlan(user, Plan.PREMIUM);
        mockMvc.perform(get("/api/users/me").header("Authorization", user.bearer()))
                .andExpect(jsonPath("$.plan").value("PREMIUM"))
                .andExpect(jsonPath("$.garmentLimit").value(20));

        promoteToAdmin(user);
        mockMvc.perform(get("/api/users/me").header("Authorization", user.bearer()))
                .andExpect(jsonPath("$.garmentLimit").doesNotExist());
    }

    @Test
    @DisplayName("an admin can set an account's plan; a normal user cannot")
    void onlyAdminsSetPlans() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        TestUser target = registerUser();
        TestUser stranger = registerUser();

        mockMvc.perform(patch("/api/users/" + target.userId() + "/plan")
                        .header("Authorization", stranger.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("plan", "PREMIUM"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/users/" + target.userId() + "/plan")
                        .header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("plan", "PREMIUM"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("PREMIUM"))
                .andExpect(jsonPath("$.garmentLimit").value(20));
    }

    @Test
    @DisplayName("setting a plan validates the body and 404s for an unknown account")
    void setPlanValidation() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        TestUser target = registerUser();

        mockMvc.perform(patch("/api/users/" + target.userId() + "/plan")
                        .header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/users/" + target.userId() + "/plan")
                        .header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("plan", "GOLD"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/users/999999999/plan")
                        .header("Authorization", admin.bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("plan", "PREMIUM"))))
                .andExpect(status().isNotFound());
    }
}
