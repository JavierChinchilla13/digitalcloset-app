package com.javier.closetapp.user.dto;

// Audit H12: what an EXISTING account gives at its next sign-in (or again after the texts change): the same facts a new sign-up gives.
// If the account already has a birth month/year recorded, the ones sent here are ignored (it cannot be changed from this step).
public class LegalConfirmationRequest {
    private Integer birthMonth;
    private Integer birthYear;
    private Boolean guardianAuthorized;
    private Boolean termsAccepted;
    private Boolean dataAuthorized;
    private String legalVersion;

    public LegalConfirmationRequest() {}

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
