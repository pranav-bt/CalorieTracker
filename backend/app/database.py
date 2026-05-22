from __future__ import annotations

from contextlib import contextmanager
import sqlite3
from pathlib import Path
from typing import Iterable, Iterator

from .messages import AFFIRMATIONS, DAY_GREETINGS, REWARDS

DB_PATH = Path(__file__).resolve().parents[1] / "calorie_tracker.db"


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                total_calories INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS meal_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meal_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                calories INTEGER NOT NULL,
                FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                daily_calorie_goal INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS foods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                unit TEXT NOT NULL,
                reference_quantity REAL NOT NULL,
                reference_calories INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            INSERT OR IGNORE INTO settings (id, daily_calorie_goal)
            VALUES (1, 2000);

            INSERT OR IGNORE INTO foods
                (name, unit, reference_quantity, reference_calories)
            VALUES
                ('egg', 'piece', 1, 70),
                ('toast', 'slice', 1, 80),
                ('milk', 'ml', 100, 50);
            """
        )
        _ensure_column(conn, "settings", "goal_mode", "TEXT NOT NULL DEFAULT 'daily'")
        _ensure_column(
            conn,
            "settings",
            "weekly_calorie_goal",
            "INTEGER NOT NULL DEFAULT 14000",
        )
        _ensure_column(
            conn,
            "settings",
            "history_retention_days",
            "INTEGER NOT NULL DEFAULT 0",
        )
        _ensure_column(
            conn,
            "settings",
            "week_start_day",
            "INTEGER NOT NULL DEFAULT 0",
        )
        _ensure_column(
            conn,
            "settings",
            "partner_name",
            "TEXT NOT NULL DEFAULT ''",
        )
        _ensure_column(
            conn,
            "settings",
            "challenge_completed_week",
            "TEXT NOT NULL DEFAULT ''",
        )
        _init_messages(conn)
        _init_heart_points(conn)


def _init_messages(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS day_greetings (
            day_of_week INTEGER PRIMARY KEY,
            message     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS affirmations (
            id      INTEGER PRIMARY KEY,
            text    TEXT NOT NULL
        );
        """
    )

    conn.executemany(
        "INSERT OR REPLACE INTO day_greetings (day_of_week, message) VALUES (?, ?)",
        DAY_GREETINGS,
    )
    conn.executemany(
        "INSERT OR REPLACE INTO affirmations (id, text) VALUES (?, ?)",
        AFFIRMATIONS,
    )


def _init_heart_points(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS heart_points_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            source     TEXT    NOT NULL,
            points     INTEGER NOT NULL,
            created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS rewards_catalogue (
            id    INTEGER PRIMARY KEY,
            name  TEXT    NOT NULL,
            cost  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS redemptions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            reward       TEXT    NOT NULL,
            points_spent INTEGER NOT NULL,
            created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    _ensure_column(conn, "redemptions", "claimed", "INTEGER NOT NULL DEFAULT 0")
    _ensure_column(conn, "redemptions", "claimed_at", "TEXT")
    conn.executemany(
        "INSERT OR REPLACE INTO rewards_catalogue (id, name, cost) VALUES (?, ?, ?)",
        [(i + 1, name, cost) for i, (name, cost) in enumerate(REWARDS)],
    )


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict]:
    return [dict(row) for row in rows]
