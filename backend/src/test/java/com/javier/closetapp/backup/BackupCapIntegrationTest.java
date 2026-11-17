package com.javier.closetapp.backup;

import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// The hard cap: a backup bigger than app.backup.max-bytes is refused with 413 (here the cap is tiny), nothing is sent and nothing is left.
@TestPropertySource(properties = "app.backup.max-bytes=300")
class BackupCapIntegrationTest extends IntegrationTestBase {

    @Autowired private BackupDownloadRepository downloads;
    @Autowired private BackupConcurrencyGuard guard;

    @Test
    @DisplayName("over the cap: 413 with a pointer to the script, no body, no temp file, the lock released, the row ok = false")
    void overTheCap() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);

        var result = mockMvc.perform(post("/api/admin/backup").header("Authorization", admin.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "archivePassword", "an archive passphrase 123"))))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("backup-remote-db.sh")))
                .andReturn();
        assertFalse(result.getResponse().getContentType() != null && result.getResponse().getContentType().contains("octet-stream"));

        Path tmp = Path.of("target/backup-test-tmp");
        try (Stream<Path> s = Files.list(tmp)) {
            assertEquals(0, s.filter(p -> p.getFileName().toString().startsWith("vysvi-backup-")).count());
        }
        BackupDownload row = downloads.findTop10ByOrderByIdDesc().get(0);
        assertFalse(row.isOk());
        assertEquals(0, row.getBytes());
        assertTrue(guard.tryEnter());
        guard.leave();
    }
}
