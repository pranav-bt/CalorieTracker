import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { JsonSQLite } from "@capacitor-community/sqlite";
import { closeDb, getDb, getSqliteConnection } from "./client";
import { parseFitnessBackup } from "./backupFormat";

const SAFETY_BACKUP_PATH = "backups/last-pre-import-backup.json";

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function exportObject(): Promise<JsonSQLite> {
  const db = await getDb();
  const result = await db.exportToJson("full");
  if (!result.export) throw new Error("The database could not be exported.");
  return result.export;
}

export async function shareDatabaseBackup(): Promise<string> {
  const json = JSON.stringify(await exportObject(), null, 2);
  const filename = `fitness-companion-backup-${timestamp()}.json`;
  const result = await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({
    title: "Fitness Companion backup",
    text: "Save this file somewhere safe. It contains your local Fitness Companion data.",
    url: result.uri,
    dialogTitle: "Save or share backup",
  });
  return filename;
}

export async function hasSafetyBackup(): Promise<boolean> {
  try {
    await Filesystem.stat({ path: SAFETY_BACKUP_PATH, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

async function importObject(incoming: JsonSQLite, safety: JsonSQLite): Promise<void> {
  const sqlite = getSqliteConnection();
  const importJson = JSON.stringify(incoming);
  const nativeValidation = await sqlite.isJsonValid(importJson);
  if (!nativeValidation.result) throw new Error("SQLite rejected the backup structure.");

  await closeDb();
  try {
    await sqlite.importFromJson(importJson);
  } catch (error) {
    try {
      await sqlite.importFromJson(JSON.stringify({ ...safety, overwrite: true }));
    } catch {
      throw new Error("Restore failed and the automatic rollback also failed. Keep the original backup file.");
    }
    throw error;
  }
}

export async function restoreDatabaseBackup(json: string): Promise<void> {
  const incoming = parseFitnessBackup(json);
  const safety = await exportObject();
  await Filesystem.writeFile({
    path: SAFETY_BACKUP_PATH,
    data: JSON.stringify(safety, null, 2),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  await importObject(incoming, safety);
}

export async function restoreSafetyBackup(): Promise<void> {
  const file = await Filesystem.readFile({
    path: SAFETY_BACKUP_PATH,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });
  if (typeof file.data !== "string") throw new Error("The safety backup could not be read.");
  await restoreDatabaseBackup(file.data);
}
