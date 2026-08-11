import type { CalorieDistributionMode } from "../types";

export function calculateTodayTarget(input: {
  planned_today: number;
  consumed_before: number;
  planned_before: number;
  days_left_including_today: number;
  mode: CalorieDistributionMode;
}): { adjusted_goal: number; carryover_adjustment: number } {
  const daysLeft = Math.max(1, input.days_left_including_today);
  const deviation = input.consumed_before - input.planned_before;
  const adjusted = input.mode === "flexible_weekly"
    ? Math.max(0, Math.round(input.planned_today - deviation / daysLeft))
    : input.planned_today;
  return {
    adjusted_goal: adjusted,
    carryover_adjustment: adjusted - input.planned_today,
  };
}
