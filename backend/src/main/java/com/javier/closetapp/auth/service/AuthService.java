package com.javier.closetapp.auth.service;

import com.javier.closetapp.auth.dto.AuthResponse;
import com.javier.closetapp.auth.google.GoogleIdentity;
import com.javier.closetapp.auth.google.GoogleTokenVerifier;
import com.javier.closetapp.auth.dto.LoginRequest;
import com.javier.closetapp.auth.dto.RegisterRequest;
import com.javier.closetapp.exception.AgeNotAllowedException;
import com.javier.closetapp.exception.InvalidInputException;
import com.javier.closetapp.legal.AgePolicy;
import com.javier.closetapp.legal.AgePolicy.AgeBand;
import com.javier.closetapp.legal.LegalVersion;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.exception.DuplicateEmailException;
import com.javier.closetapp.exception.GoogleSignInException;
import com.javier.closetapp.security.JwtService;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Registration and login. Both return a signed JWT (JwtService) plus the user's id and
// email. Registering always creates a normal user (ROLE_USER) - the request cannot
// choose a role, which is what stops anyone making themselves an admin.
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final GoogleTokenVerifier googleTokenVerifier;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, 
                       JwtService jwtService, AuthenticationManager authenticationManager,
                       GoogleTokenVerifier googleTokenVerifier) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.googleTokenVerifier = googleTokenVerifier;
    }

    // Creates the account (BCrypt-hashed password) and signs it in at once. A taken email is a 409 (DuplicateEmailException).
    public AuthResponse register(RegisterRequest request) {
        // Audit H12: age first, before ANY lookup or write, so a refused sign-up leaves nothing behind (no row, no
        // password hash, no log line) and the answer is the same whether or not the email already has an account.
        AgeBand band = AgePolicy.bandFor(request.getBirthYear(), request.getBirthMonth(), LocalDate.now(ZoneOffset.UTC));
        if (band == AgeBand.UNDER_MIN) {
            throw new AgeNotAllowedException();
        }
        requireDeclarations(band, request.getGuardianAuthorized(), request.getTermsAccepted(),
                request.getDataAuthorized(), request.getLegalVersion());

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new DuplicateEmailException("An account with this email already exists");
        }

        User user = new User(
                request.getEmail(),
                passwordEncoder.encode(request.getPassword()),
                Role.ROLE_USER
        );
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        recordDeclarations(user, band, request.getBirthYear(), request.getBirthMonth());

        User savedUser;
        try {
            // Flushed here so a second sign-up racing for the same email fails now, as a clean 409 (audit M9).
            savedUser = userRepository.saveAndFlush(user);
        } catch (org.springframework.dao.DataIntegrityViolationException raced) {
            throw new DuplicateEmailException("An account with this email already exists");
        }
        
        String jwtToken = jwtService.generateToken(savedUser);
        
        return new AuthResponse(jwtToken, savedUser.getUserId(), savedUser.getEmail());
    }

    // The declarations every new account makes (audit H12): both acceptances, the version of the texts they saw, and for a
    // 13-17 account the guardian declaration. These are DECLARATIONS, not verification; the Terms say so.
    static void requireDeclarations(AgeBand band, Boolean guardianAuthorized, Boolean termsAccepted,
                                    Boolean dataAuthorized, String legalVersion) {
        if (!Boolean.TRUE.equals(termsAccepted) || !Boolean.TRUE.equals(dataAuthorized)) {
            throw new InvalidInputException("To create an account you need to accept the Terms and the Privacy Policy and "
                    + "authorise the processing of your data.");
        }
        if (!LegalVersion.CURRENT.equals(legalVersion)) {
            throw new InvalidInputException("The Terms have been updated. Please reload the page and try again.");
        }
        if (band == AgeBand.MINOR && !Boolean.TRUE.equals(guardianAuthorized)) {
            throw new InvalidInputException("A parent or legal guardian must authorise the use of your account and data.");
        }
    }

    // Writes the facts onto the new account: birth month/year (never the day), the declarations and when they were made.
    static void recordDeclarations(User user, AgeBand band, Integer birthYear, Integer birthMonth) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        user.setBirthYear(birthYear);
        user.setBirthMonth(birthMonth);
        user.setTermsVersion(LegalVersion.CURRENT);
        user.setTermsAcceptedAt(now);
        user.setDataAuthorizedAt(now);
        if (band == AgeBand.MINOR) {
            user.setGuardianAuthorized(true);
            user.setGuardianAuthorizedAt(now);
        }
    }

    // Checks the credentials with Spring Security's AuthenticationManager (bad password, unknown
    // email and a deactivated account all fail the same way and become one 401) and issues a token.
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow();
        
        String jwtToken = jwtService.generateToken(user);
        
        return new AuthResponse(jwtToken, user.getUserId(), user.getEmail());
    }

    // Task 98 - "Sign in with Google". `credential` is the ID token the browser got from Google's button.
    // Once the token is verified (signature, issuer, audience, expiry) the account is found, linked or created:
    //  - an account already tied to this Google id signs in;
    //  - else an account with the same email (ignoring case) is LINKED: it gets the Google id and its stored
    //    password is cleared. Sign-up never verified emails, so someone may have pre-registered another
    //    person's address with a password of their own; clearing it means only the Google owner of that
    //    email gets in (a password can be set again with "Forgot password"). Its garments and outfits stay;
    //  - else a new ROLE_USER / FREE account is created from the Google profile, with no password.
    // The Google email must be verified, and a deactivated account is refused here itself, because this
    // path does not go through AuthenticationManager (which is what normally enforces it).
    @Transactional
    public AuthResponse googleLogin(String credential) {
        GoogleIdentity identity = googleTokenVerifier.verify(credential);
        if (!identity.emailVerified()) {
            throw new GoogleSignInException("Your Google email address is not verified.", 401);
        }

        User user = userRepository.findByGoogleId(identity.subject()).orElse(null);
        if (user == null) {
            user = userRepository.findFirstByEmailIgnoreCaseOrderByUserIdAsc(identity.email()).orElse(null);
            if (user != null) {
                requireActive(user);
                user.setGoogleId(identity.subject());
                user.setPassword(null);
                // A pre-registrant's tokens (made with the password just cleared) must stop working.
                user.bumpTokenVersion();
            } else {
                user = new User(identity.email(), null, Role.ROLE_USER);
                user.setGoogleId(identity.subject());
                user.setFirstName(identity.givenName());
                user.setLastName(identity.familyName());
            }
            user = userRepository.save(user);
        }
        requireActive(user);

        String jwtToken = jwtService.generateToken(user);
        return new AuthResponse(jwtToken, user.getUserId(), user.getEmail());
    }

    private static void requireActive(User user) {
        if (!user.isActive()) {
            throw new GoogleSignInException("This account has been deactivated.", 401);
        }
    }
}
