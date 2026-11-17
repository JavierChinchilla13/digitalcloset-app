package com.javier.closetapp.support;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.net.spi.InetAddressResolver;
import java.net.spi.InetAddressResolverProvider;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

// RULE: no test may ever reach a real external host (Cloudinary, Stripe, Google, a mail provider...). Stand-ins must be explicit
// (FakeStripeGateway, FakeGoogleTokenVerifier, the log mail transport...). This provider is registered for the test JVM only (see
// src/test/resources/META-INF/services/java.net.spi.InetAddressResolverProvider): any lookup of a host name that is not this machine
// FAILS with an UnknownHostException that says so, so a real call cannot happen silently and a missing stub shows up as a failing test.
// Limit: a literal IP address needs no lookup and is not caught here; the app only ever calls providers by name.
public class BlockExternalHostsResolverProvider extends InetAddressResolverProvider {

    // How many lookups this guard has refused in this JVM (the JDK rewrites the exception message, so tests read this to know the GUARD did it).
    public static final AtomicInteger BLOCKED = new AtomicInteger();

    @Override
    public InetAddressResolver get(Configuration configuration) {
        InetAddressResolver builtin = configuration.builtinResolver();
        String thisMachine = machineName();
        return new InetAddressResolver() {
            @Override
            public Stream<InetAddress> lookupByName(String host, LookupPolicy lookupPolicy) throws UnknownHostException {
                if (!isThisMachine(host, thisMachine)) {
                    BLOCKED.incrementAndGet();
                    throw new UnknownHostException("BLOCKED IN TESTS: '" + host + "' is not this machine. Tests must not reach a real host; "
                            + "use an explicit stub or fake.");
                }
                return builtin.lookupByName(host, lookupPolicy);
            }

            @Override
            public String lookupByAddress(byte[] addr) throws UnknownHostException {
                return builtin.lookupByAddress(addr);
            }
        };
    }

    @Override
    public String name() {
        return "tests-block-external-hosts";
    }

    private static boolean isThisMachine(String host, String thisMachine) {
        if (host == null) return false;
        String h = host.toLowerCase(Locale.ROOT);
        return h.equals("localhost") || h.endsWith(".localhost") || h.equals("127.0.0.1") || h.equals("::1") || h.equals("[::1]")
                || h.equals("0.0.0.0") || h.equals("ip6-localhost") || (!thisMachine.isEmpty() && h.equals(thisMachine));
    }

    private static String machineName() {
        String fromEnv = System.getenv("COMPUTERNAME");
        if (fromEnv == null || fromEnv.isBlank()) fromEnv = System.getenv("HOSTNAME");
        return fromEnv == null ? "" : fromEnv.toLowerCase(Locale.ROOT);
    }
}
