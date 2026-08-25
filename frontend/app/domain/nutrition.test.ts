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
  flex_day_calorie_target: null,
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
      flex_day_calorie_target: null,
    });

    expect(result.days[5].day_kind).toBe("flex");
    expect(result.days[5].calories).toBeGreaterThan(result.days[6].calories);
    expect(result.weekly_calories).toBe(result.calories * 7);
  });

  it("uses an exact configurable flex-day target and redistributes the rest of the week", () => {
    const result = calculateNutritionPlan({
      ...baseInput,
      flex_days_per_week: 1,
      flex_day_weekday: 5,
      flex_day_calorie_target: 3200,
    });

    expect(result.days[5].calories).toBe(3200);
    expect(result.weekly_calories).toBe(result.calories * 7);
    expect(result.days.filter((day) => day.weekday !== 5).every((day) => day.calories >= 1200)).toBe(true);
  });

  it("rejects unsafe or impossible flex-day targets", () => {
    expect(() => calculateNutritionPlan({ ...baseInput, flex_day_calorie_target: 2500 })).toThrow("Enable a flex day");
    expect(() => calculateNutritionPlan({
      ...baseInput, flex_days_per_week: 1, flex_day_weekday: 5, flex_day_calorie_target: 1000,
    })).toThrow("at least 1200");
    expect(() => calculateNutritionPlan({
      ...baseInput, flex_days_per_week: 1, flex_day_weekday: 5, flex_day_calorie_target: 13000,
    })).toThrow("leaves fewer than 1200");
  });

  it.each([
    [{ height_cm: 99 }, "Height must"],
    [{ weight_kg: 351 }, "Weight must"],
    [{ workout_days_per_week: 8 }, "Workout days"],
    [{ flex_days_per_week: 2 }, "up to one flex day"],
    [{ target_date: "2026-08-09" }, "future"],
  ] as const)("rejects invalid calculator input %o", (patch, message) => {
    expect(() => calculateNutritionPlan({ ...baseInput, ...patch })).toThrow(message);
  });
});
