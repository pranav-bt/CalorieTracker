from __future__ import annotations

from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, init_db, rows_to_dicts
from .parser import FOOD_DATABASE, parse_meal_text
from .schemas import DailySummary, HistoryDay, MealInput, MealItemUpdate, MealSummary

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


@app.post("/log-meal", response_model=MealSummary)
def log_meal(payload: MealInput) -> dict:
    items = parse_meal_text(payload.text)
    if not items:
        raise HTTPException(status_code=400, detail="No known food items found.")

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

        food = FOOD_DATABASE[item["name"]]
        calories = round(payload.quantity * int(food["calories"]))

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


def _daily_summary_for(day: str) -> dict:
    with get_connection() as conn:
        goal = conn.execute(
            "SELECT daily_calorie_goal FROM settings WHERE id = 1"
        ).fetchone()["daily_calorie_goal"]
        consumed = conn.execute(
            "SELECT COALESCE(SUM(total_calories), 0) AS total FROM meals WHERE date = ?",
            (day,),
        ).fetchone()["total"]

    return {
        "date": day,
        "goal": goal,
        "consumed": consumed,
        "remaining": goal - consumed,
    }


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

