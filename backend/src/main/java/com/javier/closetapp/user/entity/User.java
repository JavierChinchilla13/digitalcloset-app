package com.javier.closetapp.user.entity;

import com.javier.closetapp.common.enums.Plan;
import com.javier.closetapp.common.enums.Role;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

// An account (users table). It doubles as Spring Security's UserDetails: the email is the
// username, the role gives the authority, and `active` is the 'enabled' flag, so a deactivated
// account can't sign in. The password is only ever stored as a BCrypt hash.
@Entity
@Table(name = "users")
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(unique = true, nullable = false)
    private String email;

    // Null for an account created through Google sign-in (Task 98): a null hash never matches, so password
    // login fails for it until the user sets one with "Forgot password".
    @Column(name = "password_hash")
    private String password;

    // Google's stable id for the person (the sign-in token's `sub`); null if Google was never used (V10).
    @Column(name = "google_id", unique = true)
    private String googleId;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private boolean active = true;

    // Audit H1: bumped when the account's credentials change or it is deactivated. A login token carries the
    // value it was issued with and stops working as soon as it no longer matches (see JwtService).
    @Column(name = "token_version", nullable = false)
    private int tokenVersion = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // The account's main outfit (Task 78). A plain id rather than a JPA
    // relation: the users -> outfits link is only ever read/written by id, and
    // outfits already point back at users, so a relation would add a cycle for
    // nothing. The FK (V6) is ON DELETE SET NULL.
    @Column(name = "main_outfit_id")
    private Long mainOutfitId;

    // FREE or PREMIUM (Task 96; column added in V9). Decides the garment limit and whether ads show.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Plan plan = Plan.FREE;

    // Task 103: the Stripe customer / subscription behind a paid PREMIUM plan (all null for free
    // accounts and for admin-comped PREMIUM). `subscriptionStatus` is Stripe's own word (active,
    // past_due, canceled, ...), `currentPeriodEnd` when the paid period runs out.
    @Column(name = "stripe_customer_id", unique = true, length = 64)
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id", unique = true, length = 64)
    private String stripeSubscriptionId;

    @Column(name = "subscription_status", length = 32)
    private String subscriptionStatus;

    @Column(name = "current_period_end")
    private LocalDateTime currentPeriodEnd;

    @Column(name = "cancel_at_period_end", nullable = false)
    private boolean cancelAtPeriodEnd = false;

    // Audit H5: when the newest Stripe event applied to this account was created; older events are ignored.
    @Column(name = "billing_event_at")
    private LocalDateTime billingEventAt;

    // Audit H12: birth month and year (never the day), the guardian declaration, and what was accepted and when.
    // All empty for accounts made before these were asked; they are asked once at their next sign-in.
    @Column(name = "birth_year")
    private Integer birthYear;

    @Column(name = "birth_month")
    private Integer birthMonth;

    @Column(name = "guardian_authorized", nullable = false)
    private boolean guardianAuthorized = false;

    @Column(name = "guardian_authorized_at")
    private LocalDateTime guardianAuthorizedAt;

    @Column(name = "terms_version", length = 32)
    private String termsVersion;

    @Column(name = "terms_accepted_at")
    private LocalDateTime termsAcceptedAt;

    @Column(name = "data_authorized_at")
    private LocalDateTime dataAuthorizedAt;

    public User() {}

    public User(String email, String password, Role role) {
        this.email = normalizeEmail(email);
        this.password = password;
        this.role = role;
        this.active = true;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(role.name()));
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }

    public LocalDateTime getBillingEventAt() {
        return billingEventAt;
    }

    public void setBillingEventAt(LocalDateTime billingEventAt) {
        this.billingEventAt = billingEventAt;
    }

    public Integer getBirthYear() { return birthYear; }
    public void setBirthYear(Integer birthYear) { this.birthYear = birthYear; }
    public Integer getBirthMonth() { return birthMonth; }
    public void setBirthMonth(Integer birthMonth) { this.birthMonth = birthMonth; }
    public boolean isGuardianAuthorized() { return guardianAuthorized; }
    public void setGuardianAuthorized(boolean guardianAuthorized) { this.guardianAuthorized = guardianAuthorized; }
    public LocalDateTime getGuardianAuthorizedAt() { return guardianAuthorizedAt; }
    public void setGuardianAuthorizedAt(LocalDateTime guardianAuthorizedAt) { this.guardianAuthorizedAt = guardianAuthorizedAt; }
    public String getTermsVersion() { return termsVersion; }
    public void setTermsVersion(String termsVersion) { this.termsVersion = termsVersion; }
    public LocalDateTime getTermsAcceptedAt() { return termsAcceptedAt; }
    public void setTermsAcceptedAt(LocalDateTime termsAcceptedAt) { this.termsAcceptedAt = termsAcceptedAt; }
    public LocalDateTime getDataAuthorizedAt() { return dataAuthorizedAt; }
    public void setDataAuthorizedAt(LocalDateTime dataAuthorizedAt) { this.dataAuthorizedAt = dataAuthorizedAt; }

    public int getTokenVersion() {
        return tokenVersion;
    }

    // Signs the account out everywhere: every token issued before this call stops authenticating.
    public void bumpTokenVersion() {
        tokenVersion++;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = normalizeEmail(email);
    }

    // Emails are stored trimmed and in lower case, so one address is one account whatever its capitals (audit M8).
    public static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public boolean isActive() {
        return active;
    }

    public Long getMainOutfitId() {
        return mainOutfitId;
    }

    public void setMainOutfitId(Long mainOutfitId) {
        this.mainOutfitId = mainOutfitId;
    }

    public String getGoogleId() {
        return googleId;
    }

    public void setGoogleId(String googleId) {
        this.googleId = googleId;
    }

    public String getStripeCustomerId() { return stripeCustomerId; }
    public void setStripeCustomerId(String stripeCustomerId) { this.stripeCustomerId = stripeCustomerId; }

    public String getStripeSubscriptionId() { return stripeSubscriptionId; }
    public void setStripeSubscriptionId(String stripeSubscriptionId) { this.stripeSubscriptionId = stripeSubscriptionId; }

    public String getSubscriptionStatus() { return subscriptionStatus; }
    public void setSubscriptionStatus(String subscriptionStatus) { this.subscriptionStatus = subscriptionStatus; }

    public LocalDateTime getCurrentPeriodEnd() { return currentPeriodEnd; }
    public void setCurrentPeriodEnd(LocalDateTime currentPeriodEnd) { this.currentPeriodEnd = currentPeriodEnd; }

    public boolean isCancelAtPeriodEnd() { return cancelAtPeriodEnd; }
    public void setCancelAtPeriodEnd(boolean cancelAtPeriodEnd) { this.cancelAtPeriodEnd = cancelAtPeriodEnd; }

    public Plan getPlan() {
        return plan;
    }

    public void setPlan(Plan plan) {
        this.plan = plan;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
