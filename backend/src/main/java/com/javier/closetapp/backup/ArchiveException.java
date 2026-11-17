package com.javier.closetapp.backup;

import java.io.IOException;

// A backup archive that cannot be trusted: wrong password, a changed, reordered or cut-short file, or a malformed header.
// The message is deliberately the same for a wrong password and a tampered file (they cannot be told apart, and the caller must
// not learn more than "no"). It never contains the password or any content.
public class ArchiveException extends IOException {
    public ArchiveException(String message) {
        super(message);
    }

    public ArchiveException(String message, Throwable cause) {
        super(message, cause);
    }
}
