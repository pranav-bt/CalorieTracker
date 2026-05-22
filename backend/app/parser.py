from __future__ import annotations

import re
from dataclasses import dataclass

SYNONYMS = {
    "eggs": "egg",
    "bread": "toast",
}

SUPPORTED_UNITS = {"piece", "pieces", "slice", "slices", "ml", "g", "gm"}
TOKEN_RE = re.compile(r"[a-zA-Z]+|\d+(?:\.\d+)?")


@dataclass(frozen=True)
class ParsedItem:
    name: str
    quantity: float
    unit: str
    calories: int


FoodDatabase = dict[str, dict[str, int | float | str]]


def _normalize_food(token: str) -> str:
    normalized = token.lower()
    return SYNONYMS.get(normalized, normalized)


def _display_quantity(quantity: float) -> int | float:
    return int(quantity) if quantity.is_integer() else quantity


def parse_meal_text(text: str, food_database: FoodDatabase) -> list[dict]:
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
        food = food_database.get(name)
        if not food:
            continue

        reference_quantity = float(food["reference_quantity"])
        if pending_quantity is None or pending_unit is None:
            pending_quantity = None
            pending_unit = None
            continue

        quantity = pending_quantity
        unit = _normalize_unit(pending_unit)
        if unit != food["unit"]:
            pending_quantity = None
            pending_unit = None
            continue

        reference_calories = int(food["reference_calories"])
        calories = round((quantity / reference_quantity) * reference_calories)

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
    if unit == "gm":
        return "g"
    if unit == "pieces":
        return "piece"
    if unit == "slices":
        return "slice"
    return unit
