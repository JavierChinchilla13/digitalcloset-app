package com.javier.closetapp.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import com.javier.closetapp.user.entity.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

// Creates and checks the login tokens (JWT, HS256). The signing key is the Base64 secret
// in app.jwt.secret (never committed - it comes from JWT_SECRET); tokens carry the email
// as subject and expire after app.jwt.expiration-ms (24 h). No server-side session exists:
// a token is valid exactly as long as its signature and expiry check out.
@Service
public class JwtService {

    // The claim that carries User.tokenVersion (Audit H1).
    private static final String TOKEN_VERSION_CLAIM = "tv";

    @Value("${app.jwt.secret}")
    private String secretKey;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpiration;

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(new HashMap<>(), userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>(extraClaims);
        if (userDetails instanceof User user) {
            claims.put(TOKEN_VERSION_CLAIM, user.getTokenVersion());
        }
        return Jwts
                .builder()
                .claims(claims)
                .subject(userDetails.getUsername())
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + jwtExpiration))
                .signWith(getSignInKey(), Jwts.SIG.HS256)
                .compact();
    }

    // A token is valid when it names this user, has not expired and is not stale (see above). A bad signature or malformed token throws JwtException (JwtAuthenticationFilter turns that into 'not signed in').
    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        if (!username.equals(userDetails.getUsername()) || isTokenExpired(token)) {
            return false;
        }
        // A token issued before the account's last password change, reset, Google linking or deactivation is stale.
        // Tokens from before this claim existed carry none, which counts as 0.
        if (userDetails instanceof User user) {
            Integer issuedWith = extractClaim(token, claims -> claims.get(TOKEN_VERSION_CLAIM, Integer.class));
            return (issuedWith == null ? 0 : issuedWith) == user.getTokenVersion();
        }
        return true;
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        return Jwts
                .parser()
                .verifyWith(getSignInKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    // Derives the HMAC key from the Base64 secret; a secret that is not valid Base64 (or too short) fails here at the first token.
    private SecretKey getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
