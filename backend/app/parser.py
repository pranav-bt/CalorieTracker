from __future__ import annotations

import re
from dataclasses import dataclass

FOOD_DATABASE = {
    "egg": {"unit": "piece", "calories": 70},
    "toast": {"unit": "slice", "calories": 80},
    "milk": {"unit": "100ml", "calories": 50},
}

SYNONYMS = {
    "eggs": "egg",
    "bread": "toast",
}

SUPPORTED_UNITS = {"piece", "pieces", "slice", "slices", "ml", "g"}
TOKEN_RE = re.compile(r"[a-zA-Z]+|\d+(?:\.\d+)?")


@dataclass(frozen=True)
class ParsedItem:
    name: str
    quantity: float
    unit: str
    calories: int


def _normalize_food(token: str) -> str:
    normalized = token.lower()
    return SYNONYMS.get(normalized, normalized)


def _display_quantity(quantity: float) -> int | float:
    return int(quantity) if quantity.is_integer() else quantity


def parse_meal_text(text: str) -> list[dict]:
    tokens = TOKEN_RE.findall(text.lower())
    items: list[ParsedItem] = []
    pending_quantity: float | None = None
    pending_unit: str | None = None

    for token in tokens:
        if _is_number(token):
            pending_quantity = float(token)
            continue

        if token in SUPPORTED_UNITS:
            pending_unit = token
            continue

        name = _normalize_food(token)
        food = FOOD_DATABASE.get(name)
        if not food:
            continue

        quantity = pending_quantity if pending_quantity is not None else 1.0
        unit = _normalize_unit(pending_unit or food["unit"])
        per_unit_calories = int(food["calories"])
        calories = round(quantity * per_unit_calories)

        items.append(
            ParsedItem(
                name=name,
                quantity=quantity,
                unit=unit,
                calories=calories,
            )
        )
        pending_quantity = None
        pending_unit = None

    return [
        {
            "name": item.name,
            "quantity": _display_quantity(item.quantity),
            "unit": item.unit,
            "calories": item.calories,
        }
        for item in items
    ]


def _is_number(token: str) -> bool:
    try:
        float(token)
    except ValueError:
        return False
    return True


def _normalize_unit(unit: str) -> str:
    if unit == "pieces":
        return "piece"
    if unit == "slices":
        return "slice"
    return unit

