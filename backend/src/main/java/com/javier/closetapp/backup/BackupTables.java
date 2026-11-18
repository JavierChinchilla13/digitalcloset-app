package com.javier.closetapp.backup;

import java.util.List;

// Which tables go into a backup, in the order they are loaded back (parents before the rows that point at them; the one cycle, the
// users' main outfit, is handled by the restore script). A test fails when a table exists that is in neither list, so adding a table
// forces a decision here.
public final class BackupTables {

    private BackupTables() { }

    public static final List<String> INCLUDED = List.of(
            "users",
            "premium_interest",
            "clothing_items",
            "outfits",
            "outfit_items",
            "collections",
            "collection_items",
            "collection_outfits",
            "persona_display_names",
            "stripe_events",
            "image_erasure_queue");

    // Short-lived secrets (reset links, pending email/password changes) and the backup log itself are never exported. The Flyway
    // history is only READ, for the schema version in the manifest.
    public static final List<String> EXCLUDED = List.of(
            "password_reset_tokens",
            "pending_account_changes",
            "reauth_failures",
            "google_token_uses",
            "backup_downloads");

    public static final String FLYWAY_TABLE = "flyway_schema_history";
}
