import { calculateRecipeNutrition, remainingNutrition } from "./recipeNutrition";
import type { Food } from "../types";

const foods: Food[] = [
  {
    id: 1,
    name: "chicken breast",
    unit: "g",
    reference_quantity: 100,
    reference_calories: 165,
    protein_g: 31,
    carbs_g: 0,
    fat_g: 3.6,
    fiber_g: 0,
    source: "manual",
  },
  {
    id: 2,
    name: "rice",
    unit: "g",
    reference_quantity: 100,
    reference_calories: 130,
    protein_g: 2.7,
    carbs_g: 28,
    fat_g: 0.3,
    fiber_g: 0.4,
    source: "manual",
  },
];

describe("calculateRecipeNutrition", () => {
  it("scales and totals calories and every stored macro", () => {
    const estimate = calculateRecipeNutrition(foods, [
      { foodId: 1, quantity: 150 },
      { foodId: 2, quantity: 200 },
    ]);

    expect(estimate.calories).toBe(508);
    expect(estimate.protein_g).toBe(51.9);
    expect(estimate.carbs_g).toBe(56);
    expect(estimate.fat_g).toBe(6);
    expect(estimate.fiber_g).toBe(0.8);
    expect(estimate.ingredients[0]).toMatchObject({ name: "chicken breast", quantity: 150, unit: "g", calories: 248 });
  });

  it("rejects missing, duplicate, and non-positive ingredients", () => {
    expect(() => calculateRecipeNutrition(foods, [])).toThrow("Add at least one ingredient");
    expect(() => calculateRecipeNutrition(foods, [{ foodId: 3, quantity: 1 }])).toThrow("not in the food database");
    expect(() => calculateRecipeNutrition(foods, [
      { foodId: 1, quantity: 100 },
      { foodId: 1, quantity: 50 },
    ])).toThrow("selected more than once");
    expect(() => calculateRecipeNutrition(foods, [{ foodId: 1, quantity: 0 }])).toThrow("greater than zero");
  });
});

describe("remainingNutrition", () => {
  it("shows the signed amount left after consumption and a proposed recipe", () => {
    expect(remainingNutrition(
      { calories: 2000, protein_g: 150, carbs_g: 220, fat_g: 65, fiber_g: 30 },
      { calories: 800, protein_g: 60, carbs_g: 80, fat_g: 25, fiber_g: 10 },
      { calories: 500, protein_g: 45, carbs_g: 65, fat_g: 20, fiber_g: 8 }
    )).toEqual({ calories: 700, protein_g: 45, carbs_g: 75, fat_g: 20, fiber_g: 12 });
  });

  it("keeps negative values so the UI can report an overage", () => {
    expect(remainingNutrition(
      { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60, fiber_g: 30 },
      { calories: 1900, protein_g: 140, carbs_g: 190, fat_g: 55, fiber_g: 29 },
      { calories: 300, protein_g: 20, carbs_g: 20, fat_g: 10, fiber_g: 3 }
    )).toEqual({ calories: -200, protein_g: -10, carbs_g: -10, fat_g: -5, fiber_g: -2 });
  });
});
