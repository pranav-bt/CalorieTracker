import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { getDb } from "./client";
import {
  AFFIRMATIONS, DAY_GREETINGS, END_OF_DAY_GOOD, END_OF_DAY_TOUGH, LOVE_NOTES,
  MILESTONE_MESSAGES, REWARDS, WEEKLY_CHALLENGES, WEEKLY_REPORT_GREAT,
  WEEKLY_REPORT_OK, WEEKLY_REPORT_TOUGH,
} from "./messages";

const SCHEMA_VERSION = 8;

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execute("PRAGMA foreign_keys = ON;", false);
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
  if (currentVersion < 6) {
    await runMigration6(db);
    await setSchemaVersion(db, 6);
  }
  if (currentVersion < 7) {
    await runMigration7(db);
    await setSchemaVersion(db, 7);
  }
  if (currentVersion < 8) {
    await runMigration8(db);
    await setSchemaVersion(db, 8);
  }
  await db.execute(`PRAGMA user_version = ${SCHEMA_VERSION};`, false);
}

async function setSchemaVersion(db: SQLiteDBConnection, version: number): Promise<void> {
  await db.run("INSERT OR REPLACE INTO db_meta (key, value) VALUES ('schema_version', ?)", [String(version)]);
}

async function runMigration5(db: SQLiteDBConnection): Promise<void> {
  await addColumnIfMissing(db, "user_profile", "flex_day_calorie_target", "REAL");
}

async function runMigration6(db: SQLiteDBConnection): Promise<void> {
  await addColumnIfMissing(db, "user_profile", "workout_style", "TEXT NOT NULL DEFAULT 'balanced'");
}

async function runMigration7(db: SQLiteDBConnection): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS planned_meals (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      weekday        INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      slot           TEXT    NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
      name           TEXT    NOT NULL,
      total_calories INTEGER NOT NULL DEFAULT 0,
      protein_g      REAL    NOT NULL DEFAULT 0,
      carbs_g        REAL    NOT NULL DEFAULT 0,
      fat_g          REAL    NOT NULL DEFAULT 0,
      fiber_g        REAL    NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(weekday, slot)
    );

    CREATE TABLE IF NOT EXISTS planned_meal_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      planned_meal_id INTEGER NOT NULL,
      food_id         INTEGER,
      name            TEXT    NOT NULL,
      quantity        REAL    NOT NULL,
      unit            TEXT    NOT NULL,
      calories        INTEGER NOT NULL,
      protein_g       REAL    NOT NULL DEFAULT 0,
      carbs_g         REAL    NOT NULL DEFAULT 0,
      fat_g           REAL    NOT NULL DEFAULT 0,
      fiber_g         REAL    NOT NULL DEFAULT 0,
      order_index     INTEGER NOT NULL,
      FOREIGN KEY (planned_meal_id) REFERENCES planned_meals(id) ON DELETE CASCADE,
      FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS planned_meal_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      planned_meal_id INTEGER NOT NULL,
      meal_id         INTEGER NOT NULL,
      logged_on       TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(planned_meal_id, logged_on),
      FOREIGN KEY (planned_meal_id) REFERENCES planned_meals(id) ON DELETE CASCADE,
      FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_planned_meals_weekday ON planned_meals(weekday, slot);
    CREATE INDEX IF NOT EXISTS idx_planned_meal_logs_date ON planned_meal_logs(logged_on);
  `);
}

async function runMigration8(db: SQLiteDBConnection): Promise<void> {
  await addColumnIfMissing(db, "rewards_catalogue", "enabled", "INTEGER NOT NULL DEFAULT 1");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reward_preferences (
      id                        INTEGER PRIMARY KEY CHECK (id = 1),
      enabled                   INTEGER NOT NULL DEFAULT 1,
      motivations_enabled       INTEGER NOT NULL DEFAULT 1,
      love_notes_enabled        INTEGER NOT NULL DEFAULT 1,
      weekly_challenges_enabled INTEGER NOT NULL DEFAULT 1,
      points_enabled            INTEGER NOT NULL DEFAULT 1,
      system_name               TEXT    NOT NULL DEFAULT 'Heart Points',
      point_name_singular       TEXT    NOT NULL DEFAULT 'point',
      point_name_plural         TEXT    NOT NULL DEFAULT 'points',
      weekly_points_goal        INTEGER NOT NULL DEFAULT 15,
      updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS point_rules (
      action_key TEXT PRIMARY KEY,
      label      TEXT    NOT NULL,
      points     INTEGER NOT NULL CHECK (points >= 0),
      enabled    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS reward_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category    TEXT    NOT NULL,
      context_key TEXT    NOT NULL DEFAULT '',
      text        TEXT    NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_reward_messages_group ON reward_messages(category, context_key, order_index);
    INSERT OR IGNORE INTO reward_preferences (id) VALUES (1);
  `);

  const pointRules: Array<[string, string, number]> = [
    ["log_meal", "Log a meal", 1], ["goal_hit", "Reach the daily calorie target", 3],
    ["streak_7", "Reach a 7-day logging streak", 10], ["streak_30", "Reach a 30-day logging streak", 25],
    ["weekly_challenge", "Complete the weekly challenge", 5],
  ];
  for (const rule of pointRules) {
    await db.run("INSERT OR IGNORE INTO point_rules (action_key, label, points) VALUES (?, ?, ?)", rule);
  }

  const { values: countRows } = await db.query("SELECT COUNT(*) AS count FROM reward_messages");
  if (Number(countRows?.[0]?.count ?? 0) === 0) {
    const groups: Array<[string, string, string[]]> = [
      ["affirmation", "", AFFIRMATIONS], ["love_note", "", LOVE_NOTES],
      ["end_of_day_good", "", END_OF_DAY_GOOD], ["end_of_day_tough", "", END_OF_DAY_TOUGH],
      ["weekly_report_great", "", WEEKLY_REPORT_GREAT], ["weekly_report_ok", "", WEEKLY_REPORT_OK],
      ["weekly_report_tough", "", WEEKLY_REPORT_TOUGH], ["weekly_challenge", "", WEEKLY_CHALLENGES],
      ["challenge_completed", "", ["Challenge completed! Great work!"]],
      ["redemption_pending", "", ['"{reward}" is now pending.']],
      ["redemption_claimed", "", ['"{reward}" marked as completed.']],
    ];
    for (const [weekday, greeting] of DAY_GREETINGS) groups.push(["day_greeting", String(weekday), [greeting]]);
    for (const [key, messages] of Object.entries(MILESTONE_MESSAGES)) groups.push(["milestone", key, messages]);
    for (const [category, context, messages] of groups) {
      for (const [index, message] of messages.entries()) {
        await db.run(
          "INSERT INTO reward_messages (category, context_key, text, order_index) VALUES (?, ?, ?, ?)",
          [category, context, message, index]
        );
      }
    }
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
