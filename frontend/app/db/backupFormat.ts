import type { JsonSQLite } from "@capacitor-community/sqlite";
import { DB_NAME, DB_VERSION } from "./client";

export function parseFitnessBackup(json: string): JsonSQLite {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("This is not a Fitness Companion backup.");
  }

  const backup = parsed as Partial<JsonSQLite>;
  if (backup.database !== DB_NAME || backup.mode !== "full" || !Array.isArray(backup.tables)) {
    throw new Error("This is not a Fitness Companion full backup.");
  }
  if (!Number.isInteger(backup.version) || Number(backup.version) < 1) {
    throw new Error("The backup has an invalid database version.");
  }
  if (Number(backup.version) > DB_VERSION) {
    throw new Error("This backup was created by a newer app version.");
  }
  if (!backup.tables.some((table) => table?.name === "db_meta")) {
    throw new Error("The backup is missing required app data.");
  }

  return { ...backup, overwrite: true } as JsonSQLite;
}
