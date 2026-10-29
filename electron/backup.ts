import type { SkyDatabase } from "./database";
import {
  MAX_BACKUP_BYTES,
  type BackupExportResult,
  type BackupPreview,
  type BackupRestoreResult,
} from "../shared/backup";
import {
  assertExportDestination,
  assertImportSource,
  backupError,
  readBackupFile,
  sameFile,
  writeExportFile,
} from "./storage/backupFiles";

export interface BackupDialogs {
  chooseExport(): Promise<string | null>;
  chooseImport(): Promise<string | null>;
  confirmRestore(path: string, preview: BackupPreview): Promise<boolean>;
}
export class BackupService {
  private active = false;
  constructor(
    private store: SkyDatabase,
    private dialogs: BackupDialogs,
  ) {}
  get busy() {
    return this.active;
  }
  private async exclusive<T>(operation: () => Promise<T>) {
    if (this.active)
      throw new Error("Conclua ou cancele a operação de backup em andamento.");
    this.active = true;
    try {
      return await operation();
    } catch (error) {
      throw backupError(error);
    } finally {
      this.active = false;
    }
  }
  export(): Promise<BackupExportResult | null> {
    return this.exclusive(async () => {
      const path = await this.dialogs.chooseExport();
      if (!path) return null;
      assertExportDestination(path, this.store.filePath);
      const bytes = this.store.exportBytes();
      if (bytes.length > MAX_BACKUP_BYTES)
        throw new Error(
          "O banco excede o limite de 50 MB para cópias restauráveis por esta versão.",
        );
      writeExportFile(path, bytes);
      return { path, savedAt: new Date().toISOString(), bytes: bytes.length };
    });
  }
  restore(): Promise<BackupRestoreResult | null> {
    return this.exclusive(async () => {
      const path = await this.dialogs.chooseImport();
      if (!path) return null;
      assertImportSource(path, this.store.filePath);
      const bytes = readBackupFile(path);
      const prepared = this.store.prepareImport(bytes);
      try {
        if (!(await this.dialogs.confirmRestore(path, prepared.preview)))
          return null;
        const result = prepared.restore({
          preserveRollingBackup: sameFile(path, `${this.store.filePath}.bak`),
        });
        return {
          ...result,
          sourceVersion: prepared.preview.sourceVersion,
          restoredAt: new Date().toISOString(),
        };
      } finally {
        prepared.dispose();
      }
    });
  }
}
