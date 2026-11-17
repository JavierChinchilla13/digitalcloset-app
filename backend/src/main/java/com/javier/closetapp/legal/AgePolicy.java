package com.javier.closetapp.legal;

import com.javier.closetapp.exception.InvalidInputException;

import java.time.LocalDate;

// Audit H12: who may use the service, from a birth MONTH and YEAR (never the day). The server decides; the website
// mirrors these rules only to show the form sensibly. The age is worked out conservatively: you turn N at the END of
// your birth month, so someone born in March is still counted as the younger age during the whole of March.
// The two ages live here, in one place, because the Costa Rican data protection bill may change them.
public final class AgePolicy {
    public static final int MIN_AGE = 13;
    public static final int ADULT_AGE = 18;

    public enum AgeBand { UNDER_MIN, MINOR, ADULT }

    private AgePolicy() {}

    // The band for a birth month/year on a given day. An impossible date (missing, month outside 1-12, before 1900,
    // or in the future) is a 400 with a plain message; it is not an age refusal.
    public static AgeBand bandFor(Integer birthYear, Integer birthMonth, LocalDate today) {
        if (birthYear == null || birthMonth == null || birthMonth < 1 || birthMonth > 12 || birthYear < 1900) {
            throw new InvalidInputException("Please enter a valid birth month and year.");
        }
        int monthsElapsed = (today.getYear() * 12 + today.getMonthValue()) - (birthYear * 12 + birthMonth);
        if (monthsElapsed < 0) {
            throw new InvalidInputException("Please enter a valid birth month and year.");
        }
        // Completed years, counting the birth month itself as not yet finished.
        int age = Math.floorDiv(monthsElapsed - 1, 12);
        if (age < MIN_AGE) return AgeBand.UNDER_MIN;
        if (age < ADULT_AGE) return AgeBand.MINOR;
        return AgeBand.ADULT;
    }
}
