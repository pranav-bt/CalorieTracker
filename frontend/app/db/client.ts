import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";

export const DB_NAME = "fitness_companion";
export const DB_VERSION = 3;

const sqlite = new SQLiteConnection(CapacitorSQLite);
let _db: SQLiteDBConnection | null = null;

export async function getDb(): Promise<SQLiteDBConnection> {
  if (_db !== null) return _db;
  const db = await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);
  await db.open();
  _db = db;
  return db;
}

export async function closeDb(): Promise<void> {
  if (_db === null) return;
  await sqlite.closeConnection(DB_NAME, false);
  _db = null;
}

export function getSqliteConnection(): SQLiteConnection {
  return sqlite;
}
