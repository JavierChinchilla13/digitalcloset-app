package com.javier.closetapp.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// RULE: no test may reach a real external host. (The JDK caches a failed lookup briefly, so each test below uses host names of its own.) These checks prove the guard is active in the test JVM, so a test that forgot a stub fails
// loudly instead of calling Cloudinary, Stripe, Google or a mail provider.
class NoExternalNetworkTest {

    @Test
    @DisplayName("the hosts the app talks to cannot even be looked up from a test")
    void externalHostsAreBlocked() {
        for (String host : new String[]{"api.stripe.com", "res.cloudinary.com", "api.cloudinary.com", "accounts.google.com",
                "www.googleapis.com", "oauth2.googleapis.com", "api.resend.com", "script.google.com", "o0.ingest.sentry.io"}) {
            int before = BlockExternalHostsResolverProvider.BLOCKED.get();
            assertThrows(UnknownHostException.class, () -> InetAddress.getByName(host), host);
            assertTrue(BlockExternalHostsResolverProvider.BLOCKED.get() > before, "the guard (not just a DNS failure) must have refused " + host);
        }
    }

    @Test
    @DisplayName("an HTTP client or URL connection to a real host fails before any connection is made")
    void httpToARealHostFails() {
        assertThrows(Exception.class, () -> new URI("https://connect.stripe.com/v1/customers").toURL().openConnection().connect());
        assertThrows(Exception.class, () -> java.net.http.HttpClient.newHttpClient().send(
                java.net.http.HttpRequest.newBuilder(URI.create("https://upload.cloudinary.com/x/image/upload/a.png")).build(),
                java.net.http.HttpResponse.BodyHandlers.discarding()));
    }

    @Test
    @DisplayName("this machine still resolves (the in-process test servers keep working)")
    void localhostStillResolves() throws Exception {
        assertNotNull(InetAddress.getByName("localhost"));
    }
}
