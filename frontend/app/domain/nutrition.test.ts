import { calculateNutritionPlan } from "./nutrition";
import type { MacroCalculationInput } from "../types";

const baseInput: MacroCalculationInput = {
  as_of_date: "2026-08-10",
  birth_date: "1996-01-15",
  metabolic_sex: "male",
  height_cm: 180,
  weight_kg: 80,
  activity_level: "moderate",
  primary_goal: "maintain",
  target_weight_kg: null,
  target_date: null,
  workout_days_per_week: 3,
  preferred_workout_days: [0, 2, 4],
  flex_days_per_week: 0,
  flex_day_weekday: null,
};

describe("calculateNutritionPlan", () => {
  it("calculates and preserves the weekly calorie budget", () => {
    const result = calculateNutritionPlan(baseInput);

    expect(result.bmr).toBe(1780);
    expect(result.estimated_maintenance_calories).toBe(2759);
    expect(result.days).toHaveLength(7);
    expect(result.weekly_calories).toBe(result.calories * 7);
    expect(result.days.filter((day) => day.day_kind === "workout")).toHaveLength(3);
  });

  it("caps an aggressive fat-loss request and explains the estimate", () => {
    const result = calculateNutritionPlan({
      ...baseInput,
      primary_goal: "fat_loss",
      target_weight_kg: 60,
      target_date: "2026-09-10",
    });

    expect(result.estimated_maintenance_calories - result.calories).toBeLessThanOrEqual(510);
    expect(result.explanation).toContain("below estimated maintenance");
  });

  it("rejects profiles outside the supported adult scope", () => {
    expect(() => calculateNutritionPlan({ ...baseInput, birth_date: "2010-01-01" })).toThrow(
      "supports adults"
    );
  });

  it("raises a flex day without changing weekly calories", () => {
    const result = calculateNutritionPlan({
      ...baseInput,
      flex_days_per_week: 1,
      flex_day_weekday: 5,
    });

    expect(result.days[5].day_kind).toBe("flex");
    expect(result.days[5].calories).toBeGreaterThan(result.days[6].calories);
    expect(result.weekly_calories).toBe(result.calories * 7);
  });
});
