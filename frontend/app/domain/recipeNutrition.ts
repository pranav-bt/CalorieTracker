import type { Food, Macros, Unit } from "../types";

export type RecipeIngredientInput = {
  foodId: number;
  quantity: number;
};

export type CalculatedRecipeIngredient = Macros & {
  foodId: number;
  name: string;
  quantity: number;
  unit: Unit;
  calories: number;
};

export type RecipeNutritionEstimate = Macros & {
  calories: number;
  ingredients: CalculatedRecipeIngredient[];
};

export function calculateRecipeNutrition(
  foods: Food[],
  inputs: RecipeIngredientInput[]
): RecipeNutritionEstimate {
  if (!inputs.length) throw new Error("Add at least one ingredient.");

  const foodsById = new Map(foods.map((food) => [food.id, food]));
  const selectedIds = new Set<number>();
  const ingredients = inputs.map((input, index) => {
    const food = foodsById.get(input.foodId);
    if (!food) throw new Error(`Ingredient ${index + 1} is not in the food database.`);
    if (selectedIds.has(food.id)) throw new Error(`${displayName(food.name)} is selected more than once.`);
    selectedIds.add(food.id);
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new Error(`${displayName(food.name)} quantity must be greater than zero.`);
    }
    if (!Number.isFinite(food.reference_quantity) || food.reference_quantity <= 0) {
      throw new Error(`${displayName(food.name)} has an invalid reference quantity.`);
    }

    const ratio = input.quantity / food.reference_quantity;
    return {
      foodId: food.id,
      name: food.name,
      quantity: input.quantity,
      unit: food.unit,
      calories: Math.round(ratio * food.reference_calories),
      protein_g: roundMacro(ratio * food.protein_g),
      carbs_g: roundMacro(ratio * food.carbs_g),
      fat_g: roundMacro(ratio * food.fat_g),
      fiber_g: roundMacro(ratio * food.fiber_g),
    };
  });

  return {
    calories: ingredients.reduce((sum, item) => sum + item.calories, 0),
    protein_g: roundMacro(ingredients.reduce((sum, item) => sum + item.protein_g, 0)),
    carbs_g: roundMacro(ingredients.reduce((sum, item) => sum + item.carbs_g, 0)),
    fat_g: roundMacro(ingredients.reduce((sum, item) => sum + item.fat_g, 0)),
    fiber_g: roundMacro(ingredients.reduce((sum, item) => sum + item.fiber_g, 0)),
    ingredients,
  };
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function displayName(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
