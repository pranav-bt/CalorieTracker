from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MealItemInput(BaseModel):
    name: str = Field(min_length=1)
    quantity: float = Field(gt=0)
    unit: str = Field(pattern="^(piece|slice|ml|g|gm)$")


class MealInput(BaseModel):
    items: list[MealItemInput] = Field(min_length=1)


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
    milestone: str | None = None
    heart_points_earned: int = 0


class MealRecord(BaseModel):
    id: int
    date: str
    items: list[MealItemOut]
    total_calories: int


class DailySummary(BaseModel):
    date: str
    goal: int
    goal_mode: Literal["daily", "weekly"]
    daily_goal: int
    weekly_goal: int
    adjusted_goal: int
    consumed: int
    remaining: int
    week_consumed: int
    week_remaining: int
    week_start: str
    week_end: str
    week_start_day: int
    greeting: str
    affirmation: str
    streak: int
    partner_name: str
    end_of_day_note: str | None = None
    days_logged_this_week: int
    weekly_report_message: str | None = None
    current_challenge: str
    challenge_completed: bool
    heart_points: int


class HistoryDay(BaseModel):
    date: str
    total_calories: int


class MealItemUpdate(BaseModel):
    quantity: float = Field(gt=0)


class FoodCreate(BaseModel):
    name: str = Field(min_length=1)
    unit: str = Field(pattern="^(piece|slice|ml|g|gm)$")
    reference_quantity: float = Field(gt=0)
    reference_calories: int = Field(ge=0)


class FoodOut(BaseModel):
    id: int
    name: str
    unit: str
    reference_quantity: int | float
    reference_calories: int


class SettingsUpdate(BaseModel):
    goal_mode: Literal["daily", "weekly"] | None = None
    daily_calorie_goal: int | None = Field(default=None, gt=0)
    weekly_calorie_goal: int | None = Field(default=None, gt=0)
    history_retention_days: int | None = Field(default=None, ge=0)
    week_start_day: int | None = Field(default=None, ge=0, le=6)
    partner_name: str | None = None


class SettingsOut(BaseModel):
    goal_mode: Literal["daily", "weekly"]
    daily_calorie_goal: int
    weekly_calorie_goal: int
    history_retention_days: int
    week_start_day: int
    partner_name: str


class HeartPointEntry(BaseModel):
    id: int
    source: str
    points: int
    created_at: str


class RewardItem(BaseModel):
    id: int
    name: str
    cost: int


class Redemption(BaseModel):
    id: int
    reward: str
    points_spent: int
    created_at: str
    claimed: bool
    claimed_at: str | None = None


class HeartPointsOut(BaseModel):
    balance: int
    log: list[HeartPointEntry]
    rewards: list[RewardItem]
    redemptions: list[Redemption]


class RedeemRequest(BaseModel):
    reward_id: int
