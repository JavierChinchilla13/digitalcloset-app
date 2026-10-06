package com.javier.closetapp.auth.mail;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

// Delivery through a Google Apps Script web app ("relay"), active when
// app.mail.mode=relay. The script (scripts/mail-relay.gs) runs as the owner's Gmail
// account and calls MailApp.sendEmail, so the message really comes from Gmail -
// no domain, no SMTP port, no paid plan. The app POSTs JSON over HTTPS:
//   { secret, to, replyTo, subject, text, html }
// and the script answers { ok: true } or { ok: false, error }.
//
// The secret (a long random string, also stored in the script's properties) is the
// only thing keeping the script from being an open relay for anyone who finds its
// URL, so both values are required at startup and never logged.
//
// Apps Script answers a POST with a redirect to the result page; the JDK client
// follows it (turning the POST into a GET, which is what the result page expects -
// the script already ran on the POST).
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "relay")
public class AppsScriptMailTransport implements MailTransport {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final HttpClient client;
    private final URI url;
    private final String secret;

    public AppsScriptMailTransport(@Value("${app.mail.relay.url:}") String url,
                                   @Value("${app.mail.relay.secret:}") String secret) {
        if (url.isBlank() || secret.isBlank()) {
            throw new IllegalStateException(
                    "app.mail.mode=relay needs MAIL_RELAY_URL (the Apps Script web app URL) and MAIL_RELAY_SECRET");
        }
        this.url = URI.create(url.trim());
        this.secret = secret;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Override
    public void send(String toEmail, String replyTo, String subject, String text, String html) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("secret", secret);
        payload.put("to", toEmail);
        payload.put("replyTo", replyTo);
        payload.put("subject", subject);
        payload.put("text", text);
        payload.put("html", html);

        try {
            HttpRequest request = HttpRequest.newBuilder(url)
                    .timeout(Duration.ofSeconds(30)) // a cold Apps Script can take a few seconds
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(payload), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("Mail relay answered HTTP " + response.statusCode());
            }
            JsonNode body = parse(response.body());
            if (!body.path("ok").asBoolean(false)) {
                // The script's own reason (e.g. "unauthorized", a quota message);
                // never the request, which holds the secret and the recipient.
                throw new IllegalStateException("Mail relay refused the email: " + body.path("error").asText("unknown"));
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to reach the mail relay", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while sending email", e);
        }
    }

    // The relay always answers JSON; anything else (a Google sign-in or error page,
    // when the web app is not deployed for "Anyone") is a configuration problem.
    private static JsonNode parse(String body) {
        try {
            return JSON.readTree(body);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(
                    "Mail relay did not answer JSON - is the Apps Script deployed as a web app open to \"Anyone\"?", e);
        }
    }
}
