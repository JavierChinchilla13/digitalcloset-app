package com.javier.closetapp.auth.mail;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Task 94: the Apps Script relay transport, against a local stand-in for the script.
// Like the real Apps Script web app, the stand-in answers the POST with a 302 to a
// result page, and the JSON ({ ok: ... }) is only on that second request.
class AppsScriptMailTransportTest {

    private static final String SECRET = "s3cret-value-123";

    private HttpServer server;
    private String baseUrl;
    private final AtomicReference<String> postedBody = new AtomicReference<>();
    private final AtomicReference<String> postedContentType = new AtomicReference<>();
    private volatile String resultBody = "{\"ok\":true}";
    private volatile String resultContentType = "application/json";
    private volatile int postStatus = 302;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/exec", exchange -> {
            postedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            postedContentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            if (postStatus == 302) {
                exchange.getResponseHeaders().add("Location", baseUrl + "/result");
                exchange.sendResponseHeaders(302, -1);
            } else {
                exchange.sendResponseHeaders(postStatus, -1);
            }
            exchange.close();
        });
        server.createContext("/result", exchange -> {
            byte[] bytes = resultBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", resultContentType);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private AppsScriptMailTransport transport() {
        return new AppsScriptMailTransport(baseUrl + "/exec", SECRET);
    }

    private void send() {
        transport().send("ana@example.com", "owner@example.com", "Hello ñ", "plain body", "<p>html body</p>");
    }

    @Test
    @DisplayName("posts the email as JSON with the secret, follows the redirect and accepts { ok: true }")
    void sendsJsonAndFollowsRedirect() throws IOException {
        send();

        assertTrue(postedContentType.get().startsWith("application/json"));
        JsonNode body = new ObjectMapper().readTree(postedBody.get());
        assertEquals(SECRET, body.get("secret").asText());
        assertEquals("ana@example.com", body.get("to").asText());
        assertEquals("owner@example.com", body.get("replyTo").asText());
        assertEquals("Hello ñ", body.get("subject").asText());
        assertEquals("plain body", body.get("text").asText());
        assertEquals("<p>html body</p>", body.get("html").asText());
    }

    @Test
    @DisplayName("an { ok: false } answer fails with the script's reason, without leaking the secret or the recipient")
    void refusedByTheScript() {
        resultBody = "{\"ok\":false,\"error\":\"unauthorized\"}";

        IllegalStateException e = assertThrows(IllegalStateException.class, this::send);

        assertTrue(e.getMessage().contains("unauthorized"));
        assertFalse(e.getMessage().contains(SECRET));
        assertFalse(e.getMessage().contains("ana@example.com"));
    }

    @Test
    @DisplayName("an HTML answer (Google sign-in / error page) is reported as a deployment problem")
    void notJson() {
        resultBody = "<html><body>Sign in</body></html>";
        resultContentType = "text/html";

        IllegalStateException e = assertThrows(IllegalStateException.class, this::send);

        assertTrue(e.getMessage().contains("did not answer JSON"));
    }

    @Test
    @DisplayName("a server error is a failure")
    void serverError() {
        postStatus = 500;

        IllegalStateException e = assertThrows(IllegalStateException.class, this::send);

        assertTrue(e.getMessage().contains("500"));
    }

    @Test
    @DisplayName("an unreachable relay is a failure, not a hang")
    void unreachable() {
        int closedPort = server.getAddress().getPort();
        server.stop(0);
        AppsScriptMailTransport t = new AppsScriptMailTransport("http://127.0.0.1:" + closedPort + "/exec", SECRET);

        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> t.send("ana@example.com", "owner@example.com", "s", "t", "<p>h</p>"));

        assertNotNull(e.getMessage());
    }

    @Test
    @DisplayName("relay mode refuses to start without the URL and the secret")
    void requiresConfiguration() {
        assertThrows(IllegalStateException.class, () -> new AppsScriptMailTransport("", SECRET));
        assertThrows(IllegalStateException.class, () -> new AppsScriptMailTransport(baseUrl + "/exec", ""));
        assertThrows(IllegalStateException.class, () -> new AppsScriptMailTransport("  ", "  "));
    }
}
