package com.javier.closetapp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

// Task 24: a per-IP request limit on the public account endpoints (login,
// register, forgot-password, reset-password - everything under /api/auth/).
// They are the only endpoints an anonymous visitor can call, so they are what a
// password-guessing or sign-up-spamming script goes for. Everything else needs
// a valid login already.
//
// A fixed window per client address: at most `maxRequests` calls in each
// `windowSeconds`; the extra ones get 429 with a Retry-After header. The counts
// live in memory - fine for the single instance this app runs as (a restart
// forgets them, which only ever helps an attacker for one window) - and expired
// windows are swept out so the map cannot grow without bound.
//
// "Client address" is request.getRemoteAddr(). Behind the reverse proxy
// (Caddy / Render) that is the proxy's address unless the server is told to
// trust X-Forwarded-For, which the production profile does through
// server.forward-headers-strategy=native (Tomcat only honours the header when it
// comes from a private-network proxy, so a visitor cannot invent their own).
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String PROTECTED_PREFIX = "/api/auth/";
    // Sweep expired windows once the map is this big (an attacker rotating
    // addresses would otherwise fill it).
    private static final int SWEEP_THRESHOLD = 10_000;

    private final boolean enabled;
    private final int maxRequests;
    private final long windowMillis;
    private final LongSupplier clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        final long startedAt;
        int count;

        Window(long startedAt) {
            this.startedAt = startedAt;
        }
    }

    @Autowired
    public RateLimitFilter(
            @Value("${app.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.rate-limit.auth.max-requests:30}") int maxRequests,
            @Value("${app.rate-limit.auth.window-seconds:60}") long windowSeconds) {
        this(enabled, maxRequests, windowSeconds, System::currentTimeMillis);
    }

    // The clock is a parameter so the tests can move time without sleeping.
    RateLimitFilter(boolean enabled, int maxRequests, long windowSeconds, LongSupplier clock) {
        this.enabled = enabled;
        this.maxRequests = maxRequests;
        this.windowMillis = windowSeconds * 1000;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        // CORS preflight (OPTIONS) is answered before this and never counts.
        return !enabled
                || "OPTIONS".equalsIgnoreCase(request.getMethod())
                || !request.getRequestURI().startsWith(PROTECTED_PREFIX);
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        long now = clock.getAsLong();
        if (windows.size() > SWEEP_THRESHOLD) {
            windows.values().removeIf(w -> now - w.startedAt >= windowMillis);
        }

        Window window = windows.compute(request.getRemoteAddr(), (ip, current) -> {
            if (current == null || now - current.startedAt >= windowMillis) {
                current = new Window(now);
            }
            current.count++;
            return current;
        });

        if (window.count > maxRequests) {
            long retryAfterSeconds = Math.max(1, (window.startedAt + windowMillis - now + 999) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write(
                    "{\"message\":\"Too many attempts - please wait a minute and try again\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
