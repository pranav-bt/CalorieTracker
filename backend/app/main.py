from __future__ import annotations

from datetime import date, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, init_db, rows_to_dicts
from .schemas import (
    DailySummary,
    FoodCreate,
    FoodOut,
    HistoryDay,
    MealInput,
    MealItemUpdate,
    MealRecord,
    MealSummary,
    SettingsOut,
    SettingsUpdate,
)

app = FastAPI(title="Calorie Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    _purge_old_history()


@app.post("/log-meal", response_model=MealSummary)
def log_meal(payload: MealInput) -> dict:
    items = _calculate_meal_items(payload.items)
    if not items:
        raise HTTPException(status_code=400, detail="At least one meal item is required.")

    meal_date = date.today().isoformat()
    total_calories = sum(item["calories"] for item in items)

    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO meals (date, total_calories) VALUES (?, ?)",
            (meal_date, total_calories),
        )
        meal_id = int(cursor.lastrowid)

        conn.executemany(
            """
            INSERT INTO meal_items (meal_id, name, quantity, unit, calories)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    meal_id,
                    item["name"],
                    item["quantity"],
                    item["unit"],
                    item["calories"],
                )
                for item in items
            ],
        )

    summary = _daily_summary_for(meal_date)
    return {
        "id": meal_id,
        "date": meal_date,
        "items": items,
        "total_calories": total_calories,
        "daily_total": summary["consumed"],
        "remaining": summary["remaining"],
    }


@app.get("/daily-summary", response_model=DailySummary)
def get_daily_summary() -> dict:
    return _daily_summary_for(date.today().isoformat())


@app.get("/settings", response_model=SettingsOut)
def get_settings() -> dict:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()
    return dict(row)


@app.patch("/settings", response_model=DailySummary)
def update_settings(payload: SettingsUpdate) -> dict:
    with get_connection() as conn:
        current = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()

        goal_mode = payload.goal_mode or current["goal_mode"]

        if payload.goal_mode == "daily" and payload.daily_calorie_goal is None:
            raise HTTPException(status_code=400, detail="Daily goal is required.")
        if payload.goal_mode == "weekly" and payload.weekly_calorie_goal is None:
            raise HTTPException(status_code=400, detail="Weekly goal is required.")

        daily_goal = (
            payload.daily_calorie_goal
            if payload.daily_calorie_goal is not None
            else current["daily_calorie_goal"]
        )
        weekly_goal = (
            payload.weekly_calorie_goal
            if payload.weekly_calorie_goal is not None
            else current["weekly_calorie_goal"]
        )

        if payload.goal_mode == "daily":
            weekly_goal = daily_goal * 7
        elif payload.goal_mode == "weekly":
            daily_goal = round(weekly_goal / 7)

        retention = (
            payload.history_retention_days
            if payload.history_retention_days is not None
            else current["history_retention_days"]
        )
        week_start_day = (
            payload.week_start_day
            if payload.week_start_day is not None
            else current["week_start_day"]
        )

        conn.execute(
            """
            UPDATE settings
            SET goal_mode = ?, daily_calorie_goal = ?, weekly_calorie_goal = ?,
                history_retention_days = ?, week_start_day = ?
            WHERE id = 1
            """,
            (goal_mode, daily_goal, weekly_goal, retention, week_start_day),
        )

    return _daily_summary_for(date.today().isoformat())


@app.get("/history", response_model=list[HistoryDay])
def get_history() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT date, SUM(total_calories) AS total_calories
            FROM meals
            GROUP BY date
            ORDER BY date DESC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/meals", response_model=list[MealRecord])
def get_meals(date_filter: str | None = None) -> list[dict]:
    meal_date = date_filter or date.today().isoformat()

    with get_connection() as conn:
        meals = rows_to_dicts(
            conn.execute(
                """
                SELECT id, date, total_calories
                FROM meals
                WHERE date = ?
                ORDER BY created_at DESC, id DESC
                """,
                (meal_date,),
            ).fetchall()
        )

        for meal in meals:
            meal["items"] = rows_to_dicts(
                conn.execute(
                    """
                    SELECT name, quantity, unit, calories
                    FROM meal_items
                    WHERE meal_id = ?
                    ORDER BY id
                    """,
                    (meal["id"],),
                ).fetchall()
            )

    return meals


@app.get("/foods", response_model=list[FoodOut])
def get_foods() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, unit, reference_quantity, reference_calories
            FROM foods
            ORDER BY name
            """
        ).fetchall()
    return [_serialize_food(row) for row in rows_to_dicts(rows)]


@app.post("/foods", response_model=FoodOut)
def upsert_food(payload: FoodCreate) -> dict:
    name = payload.name.strip().lower()
    unit = _normalize_food_unit(payload.unit)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO foods (name, unit, reference_quantity, reference_calories)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                unit = excluded.unit,
                reference_quantity = excluded.reference_quantity,
                reference_calories = excluded.reference_calories
            """,
            (name, unit, payload.reference_quantity, payload.reference_calories),
        )
        row = conn.execute(
            """
            SELECT id, name, unit, reference_quantity, reference_calories
            FROM foods
            WHERE name = ?
            """,
            (name,),
        ).fetchone()

    return _serialize_food(dict(row))


@app.patch("/meal/{meal_id}", response_model=MealSummary)
def update_meal_item_quantity(meal_id: int, payload: MealItemUpdate) -> dict:
    with get_connection() as conn:
        meal = conn.execute("SELECT * FROM meals WHERE id = ?", (meal_id,)).fetchone()
        if meal is None:
            raise HTTPException(status_code=404, detail="Meal not found.")

        item = conn.execute(
            "SELECT * FROM meal_items WHERE meal_id = ? ORDER BY id LIMIT 1",
            (meal_id,),
        ).fetchone()
        if item is None:
            raise HTTPException(status_code=404, detail="Meal item not found.")

        food = _food_database().get(item["name"])
        if food is None:
            raise HTTPException(status_code=400, detail="Food item no longer exists.")

        calories = round(
            (payload.quantity / float(food["reference_quantity"]))
            * int(food["reference_calories"])
        )

        conn.execute(
            """
            UPDATE meal_items
            SET quantity = ?, calories = ?
            WHERE id = ?
            """,
            (payload.quantity, calories, item["id"]),
        )

        total_calories = conn.execute(
            "SELECT SUM(calories) AS total FROM meal_items WHERE meal_id = ?",
            (meal_id,),
        ).fetchone()["total"]

        conn.execute(
            "UPDATE meals SET total_calories = ? WHERE id = ?",
            (total_calories, meal_id),
        )

    return _meal_summary(meal_id)


@app.delete("/meal/{meal_id}")
def delete_meal(meal_id: int) -> dict:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Meal not found.")
    return {"deleted": True}


@app.delete("/history/{day}")
def delete_history_day(day: str) -> dict:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM meals WHERE date = ?", (day,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No meals found for that date.")
    return {"deleted": True}


def _purge_old_history() -> None:
    with get_connection() as conn:
        retention = conn.execute(
            "SELECT history_retention_days FROM settings WHERE id = 1"
        ).fetchone()["history_retention_days"]
        if retention == 0:
            return
        cutoff = (date.today() - timedelta(days=retention)).isoformat()
        conn.execute("DELETE FROM meals WHERE date < ?", (cutoff,))


def _daily_summary_for(day: str) -> dict:
    current_day = date.fromisoformat(day)

    with get_connection() as conn:
        settings = conn.execute("SELECT * FROM settings WHERE id = 1").fetchone()

    week_start_day = int(settings["week_start_day"])
    days_since_start = (current_day.weekday() - week_start_day) % 7
    week_start = current_day - timedelta(days=days_since_start)
    week_end = week_start + timedelta(days=6)

    with get_connection() as conn:
        today_consumed = conn.execute(
            "SELECT COALESCE(SUM(total_calories), 0) AS total FROM meals WHERE date = ?",
            (day,),
        ).fetchone()["total"]
        consumed_before_today = conn.execute(
            """
            SELECT COALESCE(SUM(total_calories), 0) AS total
            FROM meals
            WHERE date >= ? AND date < ?
            """,
            (week_start.isoformat(), day),
        ).fetchone()["total"]
        logged_days_before_today = conn.execute(
            """
            SELECT COUNT(DISTINCT date) AS total
            FROM meals
            WHERE date >= ? AND date < ?
            """,
            (week_start.isoformat(), day),
        ).fetchone()["total"]
        week_consumed = conn.execute(
            """
            SELECT COALESCE(SUM(total_calories), 0) AS total
            FROM meals
            WHERE date >= ? AND date <= ?
            """,
            (week_start.isoformat(), week_end.isoformat()),
        ).fetchone()["total"]

    weekly_goal = int(settings["weekly_calorie_goal"])
    daily_goal = int(settings["daily_calorie_goal"])
    days_left_including_today = (week_end - current_day).days + 1
    prior_day_delta = consumed_before_today - (daily_goal * logged_days_before_today)
    adjusted_goal = max(
        0,
        round(daily_goal - (prior_day_delta / days_left_including_today)),
    )

    return {
        "date": day,
        "goal": adjusted_goal,
        "goal_mode": settings["goal_mode"],
        "daily_goal": daily_goal,
        "weekly_goal": weekly_goal,
        "adjusted_goal": adjusted_goal,
        "consumed": today_consumed,
        "remaining": adjusted_goal - today_consumed,
        "week_consumed": week_consumed,
        "week_remaining": weekly_goal - week_consumed,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "week_start_day": week_start_day,
    }


def _food_database() -> dict[str, dict[str, int | float | str]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT name, unit, reference_quantity, reference_calories
            FROM foods
            """
        ).fetchall()

    return {row["name"]: dict(row) for row in rows}


def _calculate_meal_items(items: list) -> list[dict]:
    food_database = _food_database()
    calculated_items = []

    for item in items:
        name = item.name.strip().lower()
        unit = _normalize_food_unit(item.unit)
        food = food_database.get(name)

        if food is None:
            raise HTTPException(status_code=400, detail=f"Unknown food: {name}")

        if unit != food["unit"]:
            raise HTTPException(
                status_code=400,
                detail=f"{name} must be logged in {food['unit']}.",
            )

        calories = round(
            (item.quantity / float(food["reference_quantity"]))
            * int(food["reference_calories"])
        )
        calculated_items.append(
            {
                "name": name,
                "quantity": _display_quantity(item.quantity),
                "unit": unit,
                "calories": calories,
            }
        )

    return calculated_items


def _normalize_food_unit(unit: str) -> str:
    if unit == "gm":
        return "g"
    return unit


def _serialize_food(food: dict) -> dict:
    quantity = float(food["reference_quantity"])
    return {
        **food,
        "reference_quantity": int(quantity) if quantity.is_integer() else quantity,
    }


def _display_quantity(quantity: float) -> int | float:
    return int(quantity) if quantity.is_integer() else quantity


def _meal_summary(meal_id: int) -> dict:
    with get_connection() as conn:
        meal = conn.execute("SELECT * FROM meals WHERE id = ?", (meal_id,)).fetchone()
        if meal is None:
            raise HTTPException(status_code=404, detail="Meal not found.")

        items = rows_to_dicts(
            conn.execute(
                """
                SELECT name, quantity, unit, calories
                FROM meal_items
                WHERE meal_id = ?
                ORDER BY id
                """,
                (meal_id,),
            ).fetchall()
        )

    summary = _daily_summary_for(meal["date"])
    return {
        "id": meal["id"],
        "date": meal["date"],
        "items": items,
        "total_calories": meal["total_calories"],
        "daily_total": summary["consumed"],
        "remaining": summary["remaining"],
    }
