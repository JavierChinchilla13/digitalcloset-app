package com.javier.closetapp.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Task 24: the request limit on /api/auth/**, driven with a fake clock so a
// "minute" passes instantly.
class RateLimitFilterTest {

    private final AtomicLong now = new AtomicLong(1_000_000);

    private RateLimitFilter filter(boolean enabled, int max) {
        return new RateLimitFilter(enabled, max, 60, now::get);
    }

    // Sends one request; returns the response (status 200 when the chain ran).
    private MockHttpServletResponse call(RateLimitFilter filter, String method, String path, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr(ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    @DisplayName("calls up to the limit go through, the next one is a 429 with Retry-After")
    void blocksBeyondTheLimit() throws Exception {
        RateLimitFilter f = filter(true, 3);
        for (int i = 0; i < 3; i++) {
            assertEquals(200, call(f, "POST", "/api/auth/login", "1.1.1.1").getStatus());
        }
        MockHttpServletResponse blocked = call(f, "POST", "/api/auth/login", "1.1.1.1");

        assertEquals(429, blocked.getStatus());
        assertNotNull(blocked.getHeader("Retry-After"));
        assertTrue(Integer.parseInt(blocked.getHeader("Retry-After")) <= 60);
        assertTrue(blocked.getContentAsString().contains("Too many attempts"));
    }

    @Test
    @DisplayName("every /api/auth endpoint shares the one budget")
    void sharedBudget() throws Exception {
        RateLimitFilter f = filter(true, 2);
        call(f, "POST", "/api/auth/login", "1.1.1.1");
        call(f, "POST", "/api/auth/register", "1.1.1.1");
        assertEquals(429, call(f, "POST", "/api/auth/forgot-password", "1.1.1.1").getStatus());
    }

    @Test
    @DisplayName("a new window starts after the time is up")
    void windowResets() throws Exception {
        RateLimitFilter f = filter(true, 1);
        assertEquals(200, call(f, "POST", "/api/auth/login", "1.1.1.1").getStatus());
        assertEquals(429, call(f, "POST", "/api/auth/login", "1.1.1.1").getStatus());

        now.addAndGet(60_000);

        assertEquals(200, call(f, "POST", "/api/auth/login", "1.1.1.1").getStatus());
    }

    @Test
    @DisplayName("Retry-After counts down as the window passes")
    void retryAfterShrinks() throws Exception {
        RateLimitFilter f = filter(true, 1);
        call(f, "POST", "/api/auth/login", "1.1.1.1");
        now.addAndGet(45_000);
        MockHttpServletResponse blocked = call(f, "POST", "/api/auth/login", "1.1.1.1");
        assertEquals("15", blocked.getHeader("Retry-After"));
    }

    @Test
    @DisplayName("each address has its own budget")
    void perAddress() throws Exception {
        RateLimitFilter f = filter(true, 1);
        assertEquals(200, call(f, "POST", "/api/auth/login", "1.1.1.1").getStatus());
        assertEquals(429, call(f, "POST", "/api/auth/login", "1.1.1.1").getStatus());
        assertEquals(200, call(f, "POST", "/api/auth/login", "2.2.2.2").getStatus());
    }

    @Test
    @DisplayName("only /api/auth is limited: the rest of the API and the health check never are")
    void otherPathsUntouched() throws Exception {
        RateLimitFilter f = filter(true, 1);
        for (int i = 0; i < 5; i++) {
            assertEquals(200, call(f, "GET", "/api/clothing", "1.1.1.1").getStatus());
            assertEquals(200, call(f, "GET", "/actuator/health", "1.1.1.1").getStatus());
        }
    }

    @Test
    @DisplayName("CORS preflight requests do not use up the budget")
    void preflightIgnored() throws Exception {
        RateLimitFilter f = filter(true, 1);
        for (int i = 0; i < 5; i++) {
            assertEquals(200, call(f, "OPTIONS", "/api/auth/login", "1.1.1.1").getStatus());
        }
        assertEquals(200, call(f, "POST", "/api/auth/login", "1.1.1.1").getStatus());
    }

    @Test
    @DisplayName("switched off, nothing is limited")
    void disabled() throws Exception {
        RateLimitFilter f = filter(false, 1);
        for (int i = 0; i < 5; i++) {
            assertEquals(200, call(f, "POST", "/api/auth/login", "1.1.1.1").getStatus());
        }
        assertNull(call(f, "POST", "/api/auth/login", "1.1.1.1").getHeader("Retry-After"));
    }
}
