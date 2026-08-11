import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";

const sqlite = new SQLiteConnection(CapacitorSQLite);
let _db: SQLiteDBConnection | null = null;

export async function getDb(): Promise<SQLiteDBConnection> {
  if (_db !== null) return _db;
  const db = await sqlite.createConnection("fitness_companion", false, "no-encryption", 2, false);
  await db.open();
  _db = db;
  return db;
}
