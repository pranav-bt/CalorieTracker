export type Unit = "g" | "ml" | "piece" | "slice";
export type GoalMode = "daily" | "weekly";

export type MealItem = {
  name: string;
  quantity: number;
  unit: Unit;
  calories: number;
};

export type MealRow = {
  name: string;
  quantity: string;
  unit: Unit;
};

export type MealSummary = {
  id: number;
  date: string;
  items: MealItem[];
  total_calories: number;
  daily_total: number;
  remaining: number;
};

export type MealRecord = {
  id: number;
  date: string;
  items: MealItem[];
  total_calories: number;
};

export type DailySummary = {
  date: string;
  goal: number;
  goal_mode: GoalMode;
  daily_goal: number;
  weekly_goal: number;
  adjusted_goal: number;
  consumed: number;
  remaining: number;
  week_consumed: number;
  week_remaining: number;
  week_start: string;
  week_end: string;
  week_start_day: number;
};

export type HistoryDay = {
  date: string;
  total_calories: number;
};

export type Food = {
  id: number;
  name: string;
  unit: Unit;
  reference_quantity: number;
  reference_calories: number;
};

export type Settings = {
  goal_mode: GoalMode;
  daily_calorie_goal: number;
  weekly_calorie_goal: number;
  history_retention_days: number;
  week_start_day: number;
};

