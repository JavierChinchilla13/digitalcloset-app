package com.javier.closetapp.legal;

// Audit H12: the version of the Terms and Privacy Policy a person accepts, stored with the acceptance. It must equal
// LEGAL_VERSION in frontend/src/config/legal.ts (a test compares the two). While the texts are a draft it reads
// YYYY-MM-draft-N. Bump it when a change is material (a new data use, provider, the age rules, retention): everyone is
// then asked to accept again at their next sign-in.
public final class LegalVersion {
    public static final String CURRENT = "2026-11-draft-1";

    private LegalVersion() {}
}
