import axios from 'axios';
import api from './axios';

// The admin "Download backup" endpoints (BackupController, admin only). The archive is an encrypted file; the server sets Cache-Control:
// no-store. Nothing here stores a password.

export interface BackupDownloadItem {
  downloadedAt: string;
  bytes: number;
  ok: boolean;
  // False when the alert email to the admin could not be sent (the download still happened).
  alertSent: boolean;
  adminUserId: number;
}

export interface BackupStatus {
  // null until there has been a finished download.
  lastBackupAt: string | null;
  daysSinceLastBackup: number | null;
  recent: BackupDownloadItem[];
}

export interface BackupRequest {
  // The admin's own password, or (for an admin with no password) a fresh Google credential.
  currentPassword?: string;
  googleCredential?: string;
  archivePassword: string;
}

export const backupService = {
  getStatus: async (): Promise<BackupStatus> => {
    const response = await api.get<BackupStatus>('/admin/backup/status');
    return response.data;
  },

  // Returns the encrypted archive. An error answer arrives as a Blob (because the request asks for one), so it is read back into JSON
  // here and the usual error handling (getApiErrorMessage) keeps working.
  download: async (body: BackupRequest): Promise<Blob> => {
    try {
      const response = await api.post<Blob>('/admin/backup', body, { responseType: 'blob' });
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response && err.response.data instanceof Blob) {
        try {
          err.response.data = JSON.parse(await err.response.data.text());
        } catch {
          err.response.data = {};
        }
      }
      throw err;
    }
  },
};
