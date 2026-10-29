export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface BackupPreview {
  sourceVersion: number;
  targetVersion: number;
  goals: number;
  results: number;
  routines: number;
  objectives: number;
}
export interface BackupExportResult {
  path: string;
  savedAt: string;
  bytes: number;
}
export interface BackupRestoreResult {
  snapshot: import("./types").Snapshot;
  recoveryPath: string;
  restoredAt: string;
  sourceVersion: number;
}
