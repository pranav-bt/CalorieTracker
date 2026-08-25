import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { getDb } from "./client";
import { REWARDS } from "./messages";

const SCHEMA_VERSION = 5;

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
  if (currentVersion < 1) {
    await runMigration1(db);
    await setSchemaVersion(db, 1);
  }
  if (currentVersion < 2) {
    await runMigration2(db);
    await setSchemaVersion(db, 2);
  }
  if (currentVersion < 3) {
    await runMigration3(db);
    await setSchemaVersion(db, 3);
  }
  if (currentVersion < 4) {
    await runMigration4(db);
    await setSchemaVersion(db, 4);
  }
  if (currentVersion < 5) {
    await runMigration5(db);
    await setSchemaVersion(db, 5);
  }
  await db.execute(`PRAGMA user_version = ${SCHEMA_VERSION};`, false);
}

async function setSchemaVersion(db: SQLiteDBConnection, version: number): Promise<void> {
  await db.run("INSERT OR REPLACE INTO db_meta (key, value) VALUES ('schema_version', ?)", [String(version)]);
}

async function runMigration5(db: SQLiteDBConnection): Promise<void> {
  await addColumnIfMissing(db, "user_profile", "flex_day_calorie_target", "REAL");
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

async function addColumnIfMissing(
  db: SQLiteDBConnection,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const { values } = await db.query(`PRAGMA table_info(${table})`);
  const exists = (values ?? []).some((row) => row.name === column);
  if (!exists) await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function runMigration2(db: SQLiteDBConnection): Promise<void> {
  await addColumnIfMissing(db, "settings", "calorie_distribution_mode", "TEXT NOT NULL DEFAULT 'fixed'");

  await addColumnIfMissing(db, "foods", "protein_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "foods", "carbs_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "foods", "fat_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "foods", "fiber_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "foods", "source", "TEXT NOT NULL DEFAULT 'manual'");
  await addColumnIfMissing(db, "foods", "updated_at", "TEXT");

  await addColumnIfMissing(db, "meals", "meal_type", "TEXT NOT NULL DEFAULT 'meal'");
  await addColumnIfMissing(db, "meals", "total_protein_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "meals", "total_carbs_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "meals", "total_fat_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "meals", "total_fiber_g", "REAL NOT NULL DEFAULT 0");

  await addColumnIfMissing(db, "meal_items", "protein_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "meal_items", "carbs_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "meal_items", "fat_g", "REAL NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "meal_items", "fiber_g", "REAL NOT NULL DEFAULT 0");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id                       INTEGER PRIMARY KEY CHECK (id = 1),
      birth_date               TEXT    NOT NULL DEFAULT '',
      metabolic_sex            TEXT    NOT NULL DEFAULT '',
      height_cm                REAL,
      activity_level           TEXT    NOT NULL DEFAULT 'sedentary',
      primary_goal             TEXT    NOT NULL DEFAULT 'maintain',
      target_weight_kg         REAL,
      target_date              TEXT,
      event_name               TEXT    NOT NULL DEFAULT '',
      event_date               TEXT,
      workout_days_per_week    INTEGER NOT NULL DEFAULT 3,
      preferred_workout_days_json TEXT NOT NULL DEFAULT '[]',
      workout_session_minutes  INTEGER NOT NULL DEFAULT 45,
      flex_days_per_week       INTEGER NOT NULL DEFAULT 0,
      flex_day_weekday         INTEGER,
      dietary_preferences_json TEXT    NOT NULL DEFAULT '[]',
      available_equipment_json TEXT    NOT NULL DEFAULT '[]',
      limitations_json         TEXT    NOT NULL DEFAULT '[]',
      updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS body_measurements (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at      TEXT    NOT NULL,
      weight_kg        REAL    NOT NULL,
      body_fat_percent REAL,
      waist_cm         REAL,
      chest_cm         REAL,
      hips_cm          REAL,
      arm_cm           REAL,
      thigh_cm         REAL,
      notes             TEXT    NOT NULL DEFAULT '',
      created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nutrition_plans (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      activated_at          TEXT,
      is_active             INTEGER NOT NULL DEFAULT 0,
      source                TEXT    NOT NULL,
      calculation_method    TEXT    NOT NULL,
      profile_snapshot_json TEXT    NOT NULL,
      daily_calories        INTEGER NOT NULL,
      weekly_calories       INTEGER NOT NULL,
      protein_g             REAL    NOT NULL,
      carbs_g               REAL    NOT NULL,
      fat_g                 REAL    NOT NULL,
      fiber_g               REAL    NOT NULL DEFAULT 0,
      explanation           TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS nutrition_plan_days (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id    INTEGER NOT NULL,
      weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      day_kind   TEXT    NOT NULL DEFAULT 'standard',
      calories   INTEGER NOT NULL,
      protein_g  REAL    NOT NULL,
      carbs_g    REAL    NOT NULL,
      fat_g      REAL    NOT NULL,
      fiber_g    REAL    NOT NULL DEFAULT 0,
      UNIQUE(plan_id, weekday),
      FOREIGN KEY (plan_id) REFERENCES nutrition_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recalibration_reports (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      previous_plan_id    INTEGER,
      new_plan_id         INTEGER,
      confidence          TEXT    NOT NULL,
      summary             TEXT    NOT NULL,
      evidence_json       TEXT    NOT NULL DEFAULT '[]',
      changes_json        TEXT    NOT NULL DEFAULT '[]',
      FOREIGN KEY (previous_plan_id) REFERENCES nutrition_plans(id),
      FOREIGN KEY (new_plan_id) REFERENCES nutrition_plans(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id            INTEGER,
      name               TEXT    NOT NULL,
      quantity           REAL    NOT NULL,
      unit               TEXT    NOT NULL,
      location           TEXT    NOT NULL DEFAULT 'pantry',
      expires_on         TEXT,
      low_stock_quantity REAL,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT    NOT NULL UNIQUE,
      category       TEXT    NOT NULL,
      equipment      TEXT    NOT NULL DEFAULT 'none',
      tracking_type  TEXT    NOT NULL DEFAULT 'strength',
      instructions   TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS workout_plans (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      activated_at          TEXT,
      is_active             INTEGER NOT NULL DEFAULT 0,
      source                TEXT    NOT NULL DEFAULT 'initial',
      name                  TEXT    NOT NULL,
      goal                  TEXT    NOT NULL,
      profile_snapshot_json TEXT    NOT NULL DEFAULT '{}',
      explanation           TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS workout_plan_days (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id           INTEGER NOT NULL,
      weekday           INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      title             TEXT    NOT NULL,
      focus             TEXT    NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      UNIQUE(plan_id, weekday),
      FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_plan_exercises (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_day_id       INTEGER NOT NULL,
      exercise_id       INTEGER,
      exercise_name     TEXT    NOT NULL,
      order_index       INTEGER NOT NULL,
      target_sets       INTEGER,
      target_reps_min   INTEGER,
      target_reps_max   INTEGER,
      target_rir        REAL,
      target_rpe        REAL,
      target_duration_s INTEGER,
      target_distance_m REAL,
      notes             TEXT    NOT NULL DEFAULT '',
      FOREIGN KEY (plan_day_id) REFERENCES workout_plan_days(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_day_id        INTEGER,
      scheduled_for      TEXT    NOT NULL,
      started_at         TEXT,
      completed_at       TEXT,
      status             TEXT    NOT NULL DEFAULT 'planned',
      energy_rating      INTEGER,
      recovery_rating    INTEGER,
      pain_reported      INTEGER NOT NULL DEFAULT 0,
      notes              TEXT    NOT NULL DEFAULT '',
      FOREIGN KEY (plan_day_id) REFERENCES workout_plan_days(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS workout_exercise_logs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id     INTEGER NOT NULL,
      plan_exercise_id INTEGER,
      exercise_id    INTEGER,
      exercise_name  TEXT    NOT NULL,
      order_index    INTEGER NOT NULL,
      notes          TEXT    NOT NULL DEFAULT '',
      pain_reported  INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_exercise_id) REFERENCES workout_plan_exercises(id) ON DELETE SET NULL,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_log_id    INTEGER NOT NULL,
      set_number         INTEGER NOT NULL,
      reps               INTEGER,
      load_kg            REAL,
      rir                REAL,
      rpe                REAL,
      duration_seconds   INTEGER,
      distance_meters    REAL,
      completed          INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (exercise_log_id) REFERENCES workout_exercise_logs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_body_measurements_recorded_at ON body_measurements(recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_nutrition_plans_active ON nutrition_plans(is_active, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_items(name);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(scheduled_for DESC);

    INSERT OR IGNORE INTO user_profile (id) VALUES (1);
  `);
}

async function runMigration3(db: SQLiteDBConnection): Promise<void> {
  await addColumnIfMissing(db, "workout_plan_exercises", "target_load_kg", "REAL");
  await addColumnIfMissing(db, "workout_plan_exercises", "tracking_type", "TEXT NOT NULL DEFAULT 'strength'");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workout_recalibration_reports (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
      previous_workout_plan_id INTEGER,
      new_workout_plan_id      INTEGER,
      confidence               TEXT    NOT NULL,
      summary                  TEXT    NOT NULL,
      evidence_json            TEXT    NOT NULL DEFAULT '[]',
      changes_json             TEXT    NOT NULL DEFAULT '[]',
      FOREIGN KEY (previous_workout_plan_id) REFERENCES workout_plans(id),
      FOREIGN KEY (new_workout_plan_id) REFERENCES workout_plans(id)
    );
  `);
}

async function runMigration4(db: SQLiteDBConnection): Promise<void> {
  await addColumnIfMissing(db, "settings", "calculator_draft_json", "TEXT NOT NULL DEFAULT '{}'");
  await addColumnIfMissing(db, "user_profile", "physique_goal", "TEXT NOT NULL DEFAULT 'maintain'");
  await addColumnIfMissing(db, "user_profile", "current_state", "TEXT NOT NULL DEFAULT 'both_unsure'");
  await addColumnIfMissing(db, "nutrition_plans", "archived_at", "TEXT");
  await addColumnIfMissing(db, "workout_plans", "archived_at", "TEXT");
  await db.execute(`
    UPDATE user_profile SET
      physique_goal = CASE primary_goal
        WHEN 'fat_loss' THEN 'leaner'
        WHEN 'muscle_gain' THEN 'muscular'
        WHEN 'recomposition' THEN 'fit_defined'
        WHEN 'performance' THEN 'performance'
        ELSE 'maintain'
      END,
      current_state = CASE primary_goal
        WHEN 'fat_loss' THEN 'reduce_fat'
        WHEN 'muscle_gain' THEN 'fairly_lean_gain_muscle'
        ELSE 'both_unsure'
      END
    WHERE birth_date <> '';
  `);

  const { values: measurementCountRows } = await db.query("SELECT COUNT(*) AS count FROM body_measurements");
  if (Number(measurementCountRows?.[0]?.count ?? 0) === 0) {
    const { values: planRows } = await db.query(
      "SELECT profile_snapshot_json FROM nutrition_plans ORDER BY created_at DESC, id DESC LIMIT 1"
    );
    try {
      const snapshot = JSON.parse((planRows?.[0]?.profile_snapshot_json as string) || "{}");
      if (Number(snapshot.weight_kg) > 0) {
        await db.run(
          "INSERT INTO body_measurements (recorded_at, weight_kg, notes) VALUES (date('now'), ?, ?)",
          [Number(snapshot.weight_kg), "Recovered from the previous plan during the 0.1.1 upgrade"]
        );
      }
    } catch {
      // A malformed legacy snapshot should not block the additive migration.
    }
  }
}
