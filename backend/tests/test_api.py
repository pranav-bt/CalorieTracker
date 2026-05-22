from fastapi.testclient import TestClient
import pytest

from app import database
from app.main import app


@pytest.fixture
def test_db_path(monkeypatch, request):
    db_path = request.path.parent / f"{request.node.name}.db"
    if db_path.exists():
        db_path.unlink()

    monkeypatch.setattr(database, "DB_PATH", db_path)
    yield db_path

    if db_path.exists():
        db_path.unlink()


def test_log_meal_updates_daily_summary(test_db_path):

    with TestClient(app) as client:
        response = client.post(
            "/log-meal",
            json={
                "items": [
                    {"name": "egg", "quantity": 2, "unit": "piece"},
                    {"name": "toast", "quantity": 1, "unit": "slice"},
                ]
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["items"] == [
            {"name": "egg", "quantity": 2, "unit": "piece", "calories": 140},
            {"name": "toast", "quantity": 1, "unit": "slice", "calories": 80},
        ]
        assert payload["total_calories"] == 220
        assert payload["daily_total"] == 220
        assert payload["remaining"] == 1780

        summary = client.get("/daily-summary").json()
        assert summary["goal"] == 2000
        assert summary["consumed"] == 220
        assert summary["remaining"] == 1780
        assert summary["weekly_goal"] == 14000
        assert summary["week_remaining"] == 13780


def test_log_meal_rejects_unknown_food_and_missing_quantity(test_db_path):

    with TestClient(app) as client:
        response = client.post(
            "/log-meal",
            json={"items": [{"name": "moonlight", "quantity": 1, "unit": "g"}]},
        )
        validation_response = client.post(
            "/log-meal",
            json={"items": [{"name": "milk", "unit": "ml"}]},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unknown food: moonlight"
    assert validation_response.status_code == 422


def test_log_meal_rejects_unit_mismatch(test_db_path):
    with TestClient(app) as client:
        response = client.post(
            "/log-meal",
            json={"items": [{"name": "milk", "quantity": 100, "unit": "g"}]},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "milk must be logged in ml."


def test_delete_meal_removes_it_from_history(test_db_path):

    with TestClient(app) as client:
        meal = client.post(
            "/log-meal",
            json={"items": [{"name": "milk", "quantity": 100, "unit": "ml"}]},
        ).json()

        delete_response = client.delete(f"/meal/{meal['id']}")
        assert delete_response.status_code == 200

        summary = client.get("/daily-summary").json()
        assert summary["consumed"] == 0

        history = client.get("/history").json()
        assert history == []


def test_get_meals_returns_items_for_today(test_db_path):
    with TestClient(app) as client:
        meal = client.post(
            "/log-meal",
            json={"items": [{"name": "egg", "quantity": 2, "unit": "piece"}]},
        ).json()

        response = client.get("/meals")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": meal["id"],
            "date": meal["date"],
            "items": [
                {"name": "egg", "quantity": 2, "unit": "piece", "calories": 140}
            ],
            "total_calories": 140,
        }
    ]


def test_can_add_local_food_and_log_it(test_db_path):

    with TestClient(app) as client:
        food_response = client.post(
            "/foods",
            json={
                "name": "Almond",
                "unit": "gm",
                "reference_quantity": 10,
                "reference_calories": 58,
            },
        )
        assert food_response.status_code == 200
        assert food_response.json() == {
            "id": 4,
            "name": "almond",
            "unit": "g",
            "reference_quantity": 10,
            "reference_calories": 58,
        }

        meal_response = client.post(
            "/log-meal",
            json={"items": [{"name": "almond", "quantity": 20, "unit": "g"}]},
        )

        assert meal_response.status_code == 200
        payload = meal_response.json()
        assert payload["items"] == [
            {"name": "almond", "quantity": 20, "unit": "g", "calories": 116},
        ]
        assert payload["total_calories"] == 116


def test_weekly_goal_adjusts_today_target_from_remaining_week(test_db_path):
    with TestClient(app) as client:
        settings_response = client.patch(
            "/settings",
            json={"goal_mode": "weekly", "weekly_calorie_goal": 7000},
        )
        assert settings_response.status_code == 200
        assert settings_response.json()["daily_goal"] == 1000

        meal_response = client.post(
            "/log-meal",
            json={"items": [{"name": "egg", "quantity": 10, "unit": "piece"}]},
        )
        assert meal_response.status_code == 200

        summary = client.get("/daily-summary").json()
        assert summary["goal_mode"] == "weekly"
        assert summary["weekly_goal"] == 7000
        assert summary["consumed"] == 700
        assert summary["week_consumed"] == 700
