package com.javier.closetapp.backup;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MiniJsonTest {

    @Test
    @DisplayName("a manifest survives write then read, including awkward characters")
    void manifestRoundTrip() throws Exception {
        Manifest original = new Manifest(Manifest.FORMAT, 1, "2026-11-17T10:00:00Z", "20",
                List.of(new Manifest.TableEntry("users", "users.csv", 12, 3456, "ab".repeat(32), List.of("user_id", "email"))),
                List.of("password_reset_tokens"));
        assertEquals(original, Manifest.fromJson(original.toJson()));

        Map<?, ?> parsed = (Map<?, ?>) MiniJson.parse(MiniJson.write(Map.of("s", "quote \" backslash \\ newline \n tab \t unicode é control \u0001")));
        assertEquals("quote \" backslash \\ newline \n tab \t unicode é control \u0001", parsed.get("s"));
    }

    @Test
    @DisplayName("anything that is not the manifest's own JSON is refused (garbage, trailing text, wrong types, runaway nesting)")
    void refusals() {
        for (String bad : new String[] {"", "{", "[1,", "{\"a\":}", "{} trailing", "nope", "{\"tables\": 5}", "[".repeat(100)}) {
            assertThrows(ArchiveException.class, () -> Manifest.fromJson(bad), bad);
        }
    }
}
