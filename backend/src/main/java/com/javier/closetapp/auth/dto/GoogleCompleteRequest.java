package com.javier.closetapp.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Audit H12: the second step of a NEW Google sign-up. The Google credential is verified AGAIN (it is not trusted from
// the first step), together with the birth month/year, the guardian declaration (13-17), the two separate acceptances
// and the version of the texts the person saw: the same facts a password sign-up gives.
public class GoogleCompleteRequest {
    @NotBlank(message = "Credential is required")
    @Size(max = 4096, message = "Credential is too long")
    private String credential;

    private Integer birthMonth;
    private Integer birthYear;
    private Boolean guardianAuthorized;
    private Boolean termsAccepted;
    private Boolean dataAuthorized;
    private String legalVersion;

    public GoogleCompleteRequest() {}

    public String getCredential() { return credential; }
    public void setCredential(String credential) { this.credential = credential; }
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
