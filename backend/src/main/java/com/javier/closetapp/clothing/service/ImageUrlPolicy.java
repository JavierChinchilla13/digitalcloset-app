package com.javier.closetapp.clothing.service;

import com.javier.closetapp.exception.InvalidImageUrlException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

// Audit M3: the only picture addresses a garment may carry. The browser uploads straight to Cloudinary and
// sends us the address, so without this check anyone could save an address on a host of their choosing, and
// every visitor of a shared outfit (and the owner's canvas) would load it: tracking, a tainted canvas, or
// content the app never vetted. Allowed: https addresses on a listed host (app.images.allowed-hosts, by default
// Cloudinary), and the app's own legacy "/samples/..." pictures that earlier accounts already hold.
@Component
public class ImageUrlPolicy {

    private static final int MAX_LENGTH = 500;

    private final List<String> allowedHosts;

    public ImageUrlPolicy(@Value("${app.images.allowed-hosts:res.cloudinary.com}") String allowedHosts) {
        this.allowedHosts = Arrays.stream(allowedHosts.split(","))
                .map(h -> h.trim().toLowerCase(Locale.ROOT))
                .filter(h -> !h.isEmpty())
                .toList();
    }

    // Throws InvalidImageUrlException (a 400) unless the address is allowed. A null address is left to the
    // caller (an update that does not touch the picture).
    public void requireAllowed(String url) {
        if (url == null) return;
        if (!isAllowed(url)) {
            throw new InvalidImageUrlException("The picture must be uploaded through the app.");
        }
    }

    public boolean isAllowed(String url) {
        if (url == null || url.isBlank() || url.length() > MAX_LENGTH || !url.equals(url.trim())) return false;

        // The app's own sample pictures, kept for accounts that already added them.
        if (url.startsWith("/samples/")) {
            return !url.contains("..") && !url.contains("\\") && !url.contains("//") && !url.contains("?") && !url.contains("#");
        }

        URI uri;
        try {
            uri = new URI(url);
        } catch (Exception e) {
            return false;
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (host.isEmpty() || uri.getUserInfo() != null || !allowedHosts.contains(host)) return false;
        if (scheme.equals("https")) return true;
        // Plain http only for a machine's own address, which the test setup lists; never a public host.
        return scheme.equals("http") && (host.equals("localhost") || host.equals("127.0.0.1"));
    }
}
