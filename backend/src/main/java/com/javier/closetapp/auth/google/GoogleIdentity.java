package com.javier.closetapp.auth.google;

// Who a verified Google sign-in token says the visitor is (Task 98): Google's stable id for the
// person (`subject`) and the profile claims we use. Only built from a token whose signature,
// issuer, audience and expiry were all checked.
// `issuedAt` is the token's iat claim (when Google issued it); null if the token had none.
public record GoogleIdentity(String subject, String email, boolean emailVerified, String givenName, String familyName,
                             java.time.Instant issuedAt) {
}
