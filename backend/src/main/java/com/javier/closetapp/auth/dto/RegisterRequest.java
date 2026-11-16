package com.javier.closetapp.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Registration body: email, password (at least 8 characters) and optionally first/last name. There is deliberately no role field.
public class RegisterRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a valid email address")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    // Optional: the signup form has always collected these, but this DTO had
    // no fields for them, so they were silently discarded (found while adding
    // the email-uniqueness check below).
    private String firstName;
    private String lastName;

    // Audit H12: birth MONTH and YEAR only, the guardian declaration (for 13-17), the two separate acceptances and the
    // version of the texts the person saw. The server checks all of them (AuthService.register).
    private Integer birthMonth;
    private Integer birthYear;
    private Boolean guardianAuthorized;
    private Boolean termsAccepted;
    private Boolean dataAuthorized;
    private String legalVersion;

    public RegisterRequest() {}

    public RegisterRequest(String email, String password) {
        this.email = email;
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
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

    public Integer getBirthMonth() { return birthMonth; }
    public void setBirthMonth(Integer birthMonth) { this.birthMonth = birthMonth; }
    public Integer getBirthYear() { return birthYear; }
    public void setBirthYear(Integer birthYear) { this.birthYear = birthYear; }
    public Boolean getGuardianAuthorized() { return guardianAuthorized; }
    public void setGuardianAuthorized(Boolean guardianAuthorized) { this.guardianAuthorized = guardianAuthorized; }
    public Boolean getTermsAccepted() { return termsAccepted; }
    public void setTermsAccepted(Boolean termsAccepted) { this.termsAccepted = termsAccepted; }
    public Boolean getDataAuthorized() { return dataAuthorized; }
    public void setDataAuthorized(Boolean dataAuthorized) { this.dataAuthorized = dataAuthorized; }
    public String getLegalVersion() { return legalVersion; }
    public void setLegalVersion(String legalVersion) { this.legalVersion = legalVersion; }
}
