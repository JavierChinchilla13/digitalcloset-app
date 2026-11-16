package com.javier.closetapp.legal;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Audit H12: the version of the Terms a person accepts is written in two places (backend and website). They must match.
class LegalVersionTest {

    @Test
    @DisplayName("LegalVersion.CURRENT equals LEGAL_VERSION in frontend/src/config/legal.ts")
    void backendAndFrontendVersionsMatch() throws Exception {
        Path legalTs = Path.of("..", "frontend", "src", "config", "legal.ts");
        // The backend is also built alone (Docker context = backend/): then there is no website file to compare with.
        Assumptions.assumeTrue(Files.exists(legalTs), "the website sources are not next to the backend");

        Matcher match = Pattern.compile("LEGAL_VERSION\\s*=\\s*'([^']+)'").matcher(Files.readString(legalTs));
        assertTrue(match.find(), "LEGAL_VERSION not found in legal.ts");
        assertEquals(LegalVersion.CURRENT, match.group(1));
    }
}
