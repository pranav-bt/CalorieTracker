import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { getDb } from "./client";
import { REWARDS } from "./messages";

const SCHEMA_VERSION = 1;

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS db_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const { values } = await db.query("SELECT value FROM db_meta WHERE key = 'schema_version'");
  const currentVersion = values?.[0]?.value ? parseInt(values[0].value as string) : 0;
  if (currentVersion < SCHEMA_VERSION) {
    await runMigration1(db);
    await db.run("INSERT OR REPLACE INTO db_meta (key, value) VALUES ('schema_version', ?)", [String(SCHEMA_VERSION)]);
  }
}

async function runMigration1(db: SQLiteDBConnection): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meals (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      date           TEXT    NOT NULL,
      total_calories INTEGER NOT NULL,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_items (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id  INTEGER NOT NULL,
      name     TEXT    NOT NULL,
      quantity REAL    NOT NULL,
      unit     TEXT    NOT NULL,
      calories INTEGER NOT NULL,
      FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id                      INTEGER PRIMARY KEY CHECK (id = 1),
      daily_calorie_goal      INTEGER NOT NULL DEFAULT 2000,
      goal_mode               TEXT    NOT NULL DEFAULT 'daily',
      weekly_calorie_goal     INTEGER NOT NULL DEFAULT 14000,
      history_retention_days  INTEGER NOT NULL DEFAULT 0,
      week_start_day          INTEGER NOT NULL DEFAULT 0,
      partner_name            TEXT    NOT NULL DEFAULT '',
      challenge_completed_week TEXT   NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS foods (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT    NOT NULL UNIQUE,
      unit               TEXT    NOT NULL,
      reference_quantity REAL    NOT NULL,
      reference_calories INTEGER NOT NULL,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS heart_points_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      source     TEXT    NOT NULL,
      points     INTEGER NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rewards_catalogue (
      id   INTEGER PRIMARY KEY,
      name TEXT    NOT NULL,
      cost INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      reward       TEXT    NOT NULL,
      points_spent INTEGER NOT NULL,
      claimed      INTEGER NOT NULL DEFAULT 0,
      claimed_at   TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed settings default
  await db.run("INSERT OR IGNORE INTO settings (id) VALUES (1)");

  // Seed default foods
  await db.execute(`
    INSERT OR IGNORE INTO foods (name, unit, reference_quantity, reference_calories) VALUES ('egg',   'piece', 1,   70);
    INSERT OR IGNORE INTO foods (name, unit, reference_quantity, reference_calories) VALUES ('toast', 'slice',  1,  80);
    INSERT OR IGNORE INTO foods (name, unit, reference_quantity, reference_calories) VALUES ('milk',  'ml',   100,  50);
  `);

  // Seed rewards catalogue
  for (let i = 0; i < REWARDS.length; i++) {
    const [name, cost] = REWARDS[i];
    await db.run(
      "INSERT OR REPLACE INTO rewards_catalogue (id, name, cost) VALUES (?, ?, ?)",
      [i + 1, name, cost]
    );
  }
}
