import { buildRecipePrompt, splitRecipeList, type RecipePreferences } from "./recipePrompt";
import type { InventoryItem } from "../types";

const preferences: RecipePreferences = {
  servings: 2,
  mealType: "dinner",
  maxTotalMinutes: 30,
  cuisine: "Indian",
  dietaryPreferences: ["high protein"],
  avoidIngredients: ["peanuts"],
  mustUseIngredients: ["spinach"],
  cookingEquipment: ["stovetop"],
  nutritionFocus: "high_protein",
  targetCaloriesPerServing: 550,
  pantryOnly: true,
  allowBasicStaples: true,
  additionalNotes: "Keep cleanup simple.",
};

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: 1,
    food_id: null,
    name: "chicken breast",
    quantity: 500,
    unit: "g",
    location: "fridge",
    expires_on: null,
    low_stock_quantity: null,
    updated_at: "2026-08-10T10:00:00Z",
    ...overrides,
  };
}

describe("buildRecipePrompt", () => {
  it("creates a constrained pantry prompt with nutrition context", () => {
    const result = buildRecipePrompt({
      inventory: [
        item({ name: "chicken breast" }),
        item({ id: 2, name: "spinach", quantity: 200, expires_on: "2026-08-13" }),
      ],
      preferences,
      profileDietaryPreferences: ["gluten free", "High Protein"],
      dailyTarget: { calories: 2100, protein_g: 150, carbs_g: 220, fat_g: 65, fiber_g: 30 },
      today: "2026-08-11",
    });

    expect(result.includedItemCount).toBe(2);
    expect(result.prompt).toContain("Spinach: 200 g (fridge; expires 2026-08-13; prioritize using soon)");
    expect(result.prompt).toContain("Dietary preferences: gluten free, High Protein");
    expect(result.prompt).toContain("Avoid or allergy list: peanuts");
    expect(result.prompt).toContain("2100 kcal; 150 g protein");
    expect(result.prompt).toContain("never exceed listed quantities");
  });

  it("excludes expired and zero-quantity entries", () => {
    const result = buildRecipePrompt({
      inventory: [
        item({ name: "rice", quantity: 300 }),
        item({ id: 2, name: "old milk", quantity: 500, unit: "ml", expires_on: "2026-08-10" }),
        item({ id: 3, name: "empty oats", quantity: 0 }),
      ],
      preferences,
      today: "2026-08-11",
    });

    expect(result.includedItemCount).toBe(1);
    expect(result.excludedExpiredNames).toEqual(["old milk"]);
    expect(result.prompt).toContain("Expired entries were deliberately excluded and must not be used: Old Milk.");
    expect(result.prompt).not.toContain("Empty Oats:");
  });

  it("refuses to build a prompt without usable inventory", () => {
    expect(() => buildRecipePrompt({
      inventory: [item({ quantity: 0 })],
      preferences,
      today: "2026-08-11",
    })).toThrow("Add at least one unexpired ingredient");
  });
});

describe("splitRecipeList", () => {
  it("trims, deduplicates, and supports commas or new lines", () => {
    expect(splitRecipeList("vegetarian, low sodium\nVegetarian, dairy free"))
      .toEqual(["vegetarian", "low sodium", "dairy free"]);
  });
});
