package com.javier.closetapp.backup;

import jakarta.validation.constraints.Size;

// The body of POST /api/admin/backup. Proof is the admin's own password, or a fresh Google credential for an admin who has no password.
// The archive password is typed by the admin at download time; it is never stored or logged. Passwords are never echoed in a response.
public record BackupRequest(
        @Size(max = 200) String currentPassword,
        @Size(max = 4000) String googleCredential,
        @Size(max = 200) String archivePassword) {

    @Override
    public String toString() {
        return "BackupRequest[redacted]";
    }
}
