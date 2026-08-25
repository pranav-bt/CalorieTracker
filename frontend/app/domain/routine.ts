import type { Food, Macros, MealItem } from "../types";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export function currentWeekday(date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function scaleFood(food: Food, quantity: number): MealItem {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Every ingredient needs a quantity above zero.");
  const ratio = quantity / food.reference_quantity;
  const oneDecimal = (value: number) => Math.round(value * 10) / 10;
  return {
    name: food.name,
    quantity,
    unit: food.unit,
    calories: Math.round(food.reference_calories * ratio),
    protein_g: oneDecimal(food.protein_g * ratio),
    carbs_g: oneDecimal(food.carbs_g * ratio),
    fat_g: oneDecimal(food.fat_g * ratio),
    fiber_g: oneDecimal(food.fiber_g * ratio),
  };
}

export function totalMeal(items: MealItem[]): { total_calories: number } & Macros {
  const oneDecimal = (value: number) => Math.round(value * 10) / 10;
  return {
    total_calories: items.reduce((sum, item) => sum + item.calories, 0),
    protein_g: oneDecimal(items.reduce((sum, item) => sum + item.protein_g, 0)),
    carbs_g: oneDecimal(items.reduce((sum, item) => sum + item.carbs_g, 0)),
    fat_g: oneDecimal(items.reduce((sum, item) => sum + item.fat_g, 0)),
    fiber_g: oneDecimal(items.reduce((sum, item) => sum + item.fiber_g, 0)),
  };
}
