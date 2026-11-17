package com.javier.closetapp.legal;

import com.javier.closetapp.exception.InvalidInputException;
import com.javier.closetapp.legal.AgePolicy.AgeBand;
import com.javier.closetapp.user.entity.User;

import java.time.LocalDate;
import java.time.ZoneOffset;

// Audit H12: what an account's recorded birth month/year and acceptances say TODAY (the band is worked out each time, never stored).
public final class AccountAge {
    private AccountAge() {}

    // MINOR (13-17) or ADULT, or null when the account has no birth data (an account made before it was asked) or its data is
    // unusable. An account that is UNDER_MIN today is reported as null too: it cannot exist (it would have been refused or erased).
    public static AgeBand bandOf(User user) {
        if (user.getBirthYear() == null || user.getBirthMonth() == null) return null;
        try {
            AgeBand band = AgePolicy.bandFor(user.getBirthYear(), user.getBirthMonth(), LocalDate.now(ZoneOffset.UTC));
            return band == AgeBand.UNDER_MIN ? null : band;
        } catch (InvalidInputException invalid) {
            return null;
        }
    }

    // True when the account must give (or give again) the facts the website asks for at sign-up: it has no birth data or no recorded
    // acceptance of the CURRENT version of the texts, or it is a minor without the guardian declaration.
    public static boolean needsConfirmation(User user) {
        AgeBand band = bandOf(user);
        if (band == null) return true;
        if (user.getDataAuthorizedAt() == null || user.getTermsAcceptedAt() == null) return true;
        if (!LegalVersion.CURRENT.equals(user.getTermsVersion())) return true;
        return band == AgeBand.MINOR && !user.isGuardianAuthorized();
    }
}
