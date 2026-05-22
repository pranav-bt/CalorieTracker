import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";

const sqlite = new SQLiteConnection(CapacitorSQLite);
let _db: SQLiteDBConnection | null = null;

export async function getDb(): Promise<SQLiteDBConnection> {
  if (_db !== null) return _db;
  const db = await sqlite.createConnection("calorie_tracker", false, "no-encryption", 1, false);
  await db.open();
  _db = db;
  return db;
}
