package com.javier.closetapp.common;

import com.javier.closetapp.exception.InvalidInputException;

// Audit H7: how long the text a user types may be. The columns are varchar(255); without a limit a longer name
// reached the database and came back as a 500. The same numbers are used on the DTOs (@Size) and, where a request
// is not validated as a whole (a partial garment update), by require() below.
public final class TextLimits {
    public static final int NAME = 100;
    public static final int PERSONA_NAME = 30;
    public static final int DESCRIPTION = 255;

    private TextLimits() {}

    // Throws a 400 with a message for the user when the text is longer than allowed. Null is fine (not sent).
    public static void require(String value, int max, String field) {
        if (value != null && value.length() > max) {
            throw new InvalidInputException(field + " must be at most " + max + " characters.");
        }
    }
}
