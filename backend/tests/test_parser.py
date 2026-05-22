from app.parser import parse_meal_text

FOODS = {
    "egg": {"unit": "piece", "reference_quantity": 1, "reference_calories": 70},
    "toast": {"unit": "slice", "reference_quantity": 1, "reference_calories": 80},
    "milk": {"unit": "ml", "reference_quantity": 100, "reference_calories": 50},
    "almond": {"unit": "g", "reference_quantity": 10, "reference_calories": 58},
}


def test_parse_meal_text_normalizes_synonyms_when_quantity_and_unit_are_present():
    assert parse_meal_text("2 piece eggs and 1 slice bread", FOODS) == [
        {"name": "egg", "quantity": 2, "unit": "piece", "calories": 140},
        {"name": "toast", "quantity": 1, "unit": "slice", "calories": 80},
    ]


def test_parse_meal_text_ignores_unknown_words():
    assert parse_meal_text("please log some mystery food and 100 ml milk", FOODS) == [
        {"name": "milk", "quantity": 100, "unit": "ml", "calories": 50},
    ]


def test_parse_meal_text_supports_decimal_quantities():
    assert parse_meal_text("1.5 piece egg", FOODS) == [
        {"name": "egg", "quantity": 1.5, "unit": "piece", "calories": 105},
    ]


def test_parse_meal_text_scales_local_food_references():
    assert parse_meal_text("20gm almond", FOODS) == [
        {"name": "almond", "quantity": 20, "unit": "g", "calories": 116},
    ]


def test_parse_meal_text_does_not_assume_missing_quantity_or_unit():
    assert parse_meal_text("milk", FOODS) == []
    assert parse_meal_text("100 milk", FOODS) == []
