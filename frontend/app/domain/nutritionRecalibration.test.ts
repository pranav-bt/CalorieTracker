import { calculateNutritionTrendAdjustment } from "./nutritionRecalibration";

describe("calculateNutritionTrendAdjustment", () => {
  it("waits for sufficient reliable history", () => {
    const result = calculateNutritionTrendAdjustment({ as_of_date: "2026-08-10", current_calories: 2000, goal: "fat_loss", target_weight_kg: null, target_date: null, weights: [{ date: "2026-08-10", weight_kg: 80 }], calorie_days: [] });
    expect(result.ready).toBe(false);
    expect(result.reason).toContain("Trend adjustment was not applied");
  });

  it("limits changes to 150 calories", () => {
    const weights = Array.from({ length: 11 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, weight_kg: 80 }));
    const calorie_days = weights.map((item) => ({ date: item.date, calories: 2000 }));
    const result = calculateNutritionTrendAdjustment({ as_of_date: "2026-08-11", current_calories: 2000, goal: "fat_loss", target_weight_kg: null, target_date: null, weights, calorie_days });
    expect(result.ready).toBe(true);
    expect(result.recommended_calories).toBe(1850);
  });
});
