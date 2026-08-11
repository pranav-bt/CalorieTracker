import { calculateTodayTarget } from "./dailyTarget";

describe("calculateTodayTarget", () => {
  it("keeps the weekday-specific plan target in fixed mode", () => {
    expect(calculateTodayTarget({
      planned_today: 2150, consumed_before: 1800, planned_before: 2000,
      days_left_including_today: 4, mode: "fixed",
    })).toEqual({ adjusted_goal: 2150, carryover_adjustment: 0 });
  });

  it("spreads an earlier deficit across the remaining week", () => {
    expect(calculateTodayTarget({
      planned_today: 2100, consumed_before: 1800, planned_before: 2000,
      days_left_including_today: 4, mode: "flexible_weekly",
    })).toEqual({ adjusted_goal: 2150, carryover_adjustment: 50 });
  });

  it("spreads an earlier surplus without replacing the planned day shape", () => {
    expect(calculateTodayTarget({
      planned_today: 1900, consumed_before: 2200, planned_before: 2000,
      days_left_including_today: 2, mode: "flexible_weekly",
    })).toEqual({ adjusted_goal: 1800, carryover_adjustment: -100 });
  });
});
