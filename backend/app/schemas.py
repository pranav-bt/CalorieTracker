from __future__ import annotations

from pydantic import BaseModel, Field


class MealInput(BaseModel):
    text: str = Field(min_length=1)


class MealItemOut(BaseModel):
    name: str
    quantity: int | float
    unit: str
    calories: int


class MealSummary(BaseModel):
    id: int
    date: str
    items: list[MealItemOut]
    total_calories: int
    daily_total: int
    remaining: int


class DailySummary(BaseModel):
    date: str
    goal: int
    consumed: int
    remaining: int


class HistoryDay(BaseModel):
    date: str
    total_calories: int


class MealItemUpdate(BaseModel):
    quantity: float = Field(gt=0)

