package com.javier.closetapp.security;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Task 24: the hosting platform's health probe. It must work without logging in,
// say nothing beyond UP/DOWN, and be the ONLY actuator endpoint reachable.
class HealthEndpointTest extends IntegrationTestBase {

    @Test
    @DisplayName("/actuator/health is public and reports UP")
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("the health response carries no details (no database or disk information)")
    void healthHasNoDetails() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(jsonPath("$.components").doesNotExist())
                .andExpect(jsonPath("$.details").doesNotExist());
    }

    @Test
    @DisplayName("the liveness and readiness probes are public too")
    void probesArePublic() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness")).andExpect(status().isOk());
        mockMvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("no other actuator endpoint is reachable (env, beans, metrics... need a login and are not exposed)")
    void otherActuatorEndpointsAreClosed() throws Exception {
        for (String path : new String[] {"/actuator/env", "/actuator/beans", "/actuator/metrics", "/actuator/heapdump"}) {
            // Not exposed -> unauthenticated callers are turned away before the
            // endpoint is even looked up.
            int code = mockMvc.perform(get(path)).andReturn().getResponse().getStatus();
            org.junit.jupiter.api.Assertions.assertTrue(code == 401 || code == 403, path + " answered " + code);
        }
    }
}
