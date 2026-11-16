package com.javier.closetapp.legal;

import com.javier.closetapp.exception.InvalidInputException;
import com.javier.closetapp.legal.AgePolicy.AgeBand;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

// Audit H12: the age bands, worked out from a birth month and year. Conservative: you turn N at the END of your birth month.
class AgePolicyTest {

    // "Today" is fixed so the boundaries are exact: 16 November 2026.
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 16);

    private static AgeBand band(int year, int month) {
        return AgePolicy.bandFor(year, month, TODAY);
    }

    @Test
    @DisplayName("the ages are 13 and 18")
    void agesAreThirteenAndEighteen() {
        assertEquals(13, AgePolicy.MIN_AGE);
        assertEquals(18, AgePolicy.ADULT_AGE);
    }

    @Test
    @DisplayName("someone who turned 13 last month is a minor; born in this very month they are still 12 (turns 13 at the month's end)")
    void thirteenthBirthdayBoundary() {
        assertEquals(AgeBand.MINOR, band(2013, 10));       // turned 13 at the end of October 2026
        assertEquals(AgeBand.UNDER_MIN, band(2013, 11));   // this month: not yet
        assertEquals(AgeBand.UNDER_MIN, band(2013, 12));
        assertEquals(AgeBand.MINOR, band(2013, 1));
    }

    @Test
    @DisplayName("the same rule at 18: adult from the month after the 18th birthday month")
    void eighteenthBirthdayBoundary() {
        assertEquals(AgeBand.ADULT, band(2008, 10));
        assertEquals(AgeBand.MINOR, band(2008, 11));
        assertEquals(AgeBand.MINOR, band(2008, 12));
    }

    @Test
    @DisplayName("clear cases: a child, a teenager, an adult, someone born in 1900")
    void clearCases() {
        assertEquals(AgeBand.UNDER_MIN, band(2020, 6));
        assertEquals(AgeBand.UNDER_MIN, band(2026, 11));   // born this month
        assertEquals(AgeBand.MINOR, band(2011, 3));        // 15
        assertEquals(AgeBand.ADULT, band(1990, 5));
        assertEquals(AgeBand.ADULT, band(1900, 1));
    }

    @Test
    @DisplayName("the end of December and the start of January count the same way")
    void yearBoundaries() {
        // 2 January 2027: born December 2013 has completed 13 years only at the end of December 2026.
        assertEquals(AgeBand.MINOR, AgePolicy.bandFor(2013, 12, LocalDate.of(2027, 1, 2)));
        assertEquals(AgeBand.UNDER_MIN, AgePolicy.bandFor(2013, 12, LocalDate.of(2026, 12, 31)));
    }

    @Test
    @DisplayName("an impossible date is a plain 400, not an age refusal")
    void impossibleDates() {
        assertThrows(InvalidInputException.class, () -> AgePolicy.bandFor(null, 5, TODAY));
        assertThrows(InvalidInputException.class, () -> AgePolicy.bandFor(1990, null, TODAY));
        assertThrows(InvalidInputException.class, () -> band(1990, 0));
        assertThrows(InvalidInputException.class, () -> band(1990, 13));
        assertThrows(InvalidInputException.class, () -> band(1899, 5));
        assertThrows(InvalidInputException.class, () -> band(2026, 12));   // next month: in the future
        assertThrows(InvalidInputException.class, () -> band(2030, 1));
    }
}
