import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getDailyMacroSummary, getDailySummary, getFoods, logMeal } from "../db";
import { applyInventoryDeductions, getInventoryItems } from "../db/inventory";
import { RecipeNutritionCalculator } from "./RecipeNutritionCalculator";
import type { Food, InventoryItem, MealSummary } from "../types";

jest.mock("../db", () => ({
  getFoods: jest.fn(),
  getDailySummary: jest.fn(),
  getDailyMacroSummary: jest.fn(),
  logMeal: jest.fn(),
}));
jest.mock("../db/inventory", () => ({
  getInventoryItems: jest.fn(),
  applyInventoryDeductions: jest.fn(),
}));

const mockedGetFoods = jest.mocked(getFoods);
const mockedGetDailySummary = jest.mocked(getDailySummary);
const mockedGetDailyMacroSummary = jest.mocked(getDailyMacroSummary);
const mockedLogMeal = jest.mocked(logMeal);
const mockedGetInventoryItems = jest.mocked(getInventoryItems);
const mockedApplyInventoryDeductions = jest.mocked(applyInventoryDeductions);

const foods: Food[] = [
  { id: 1, name: "chicken breast", unit: "g", reference_quantity: 100, reference_calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, source: "manual" },
  { id: 2, name: "rice", unit: "g", reference_quantity: 100, reference_calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fiber_g: 0.4, source: "manual" },
];

const inventory: InventoryItem[] = [
  { id: 20, food_id: 1, name: "chicken breast", quantity: 300, unit: "g", location: "fridge", expires_on: "2026-08-20", low_stock_quantity: null, updated_at: "2026-08-18" },
  { id: 21, food_id: 2, name: "rice", quantity: 150, unit: "g", location: "pantry", expires_on: null, low_stock_quantity: null, updated_at: "2026-08-18" },
];

const loggedMeal: MealSummary = {
  id: 10,
  date: "2026-08-12",
  items: [],
  total_calories: 425,
  total_protein_g: 36.4,
  total_carbs_g: 56,
  total_fat_g: 4.2,
  total_fiber_g: 0.8,
  daily_total: 425,
  remaining: 1575,
  milestone: null,
  heart_points_earned: 1,
};

describe("RecipeNutritionCalculator", () => {
  beforeEach(() => {
    mockedGetFoods.mockResolvedValue(foods);
    mockedGetInventoryItems.mockResolvedValue([]);
    mockedApplyInventoryDeductions.mockResolvedValue();
    mockedGetDailySummary.mockResolvedValue({
      adjusted_goal: 2000,
      consumed: 800,
      target_source: "plan",
      plan_day_kind: "workout",
    } as Awaited<ReturnType<typeof getDailySummary>>);
    mockedGetDailyMacroSummary.mockResolvedValue({
      consumed: { protein_g: 60, carbs_g: 80, fat_g: 25, fiber_g: 10 },
      target: { protein_g: 150, carbs_g: 220, fat_g: 65, fiber_g: 30 },
      plan_id: 4,
    });
    mockedLogMeal.mockResolvedValue(loggedMeal);
  });

  it("calculates multiple ingredients and commits them as one meal", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onCommitted = jest.fn();
    render(<RecipeNutritionCalculator isOpen onClose={onClose} onCommitted={onCommitted} />);

    await user.selectOptions(await screen.findByLabelText("Recipe ingredient 1"), "1");
    await user.click(screen.getByRole("button", { name: /add ingredient/i }));
    await user.selectOptions(screen.getByLabelText("Recipe ingredient 2"), "2");
    await user.clear(screen.getByLabelText("Recipe quantity 2"));
    await user.type(screen.getByLabelText("Recipe quantity 2"), "200");

    expect(screen.getByText("425 kcal")).toBeInTheDocument();
    expect(screen.getByText("1200 kcal left")).toBeInTheDocument();
    expect(screen.getByText("After recipe: 775 kcal left")).toBeInTheDocument();
    expect(screen.getByText("After recipe: 53.6 g left")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /commit to today/i }));

    await waitFor(() => expect(mockedLogMeal).toHaveBeenCalledWith([
      { name: "chicken breast", quantity: 100, unit: "g" },
      { name: "rice", quantity: 200, unit: "g" },
    ]));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCommitted).toHaveBeenCalledWith(loggedMeal);
  });

  it("exits without logging", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<RecipeNutritionCalculator isOpen onClose={onClose} onCommitted={jest.fn()} />);

    await screen.findByRole("option", { name: "Chicken Breast" });
    await user.click(screen.getByRole("button", { name: "Exit" }));

    expect(mockedLogMeal).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deducts earliest matching pantry stock only after explicit confirmation", async () => {
    mockedGetInventoryItems.mockResolvedValue(inventory);
    const user = userEvent.setup();
    const onCommitted = jest.fn();
    render(<RecipeNutritionCalculator isOpen onClose={jest.fn()} onCommitted={onCommitted} />);

    await user.selectOptions(await screen.findByLabelText("Recipe ingredient 1"), "1");
    expect(screen.getByRole("checkbox", { name: /deduct matching stock/i })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /deduct matching stock/i }));
    await user.click(screen.getByRole("button", { name: /commit to today/i }));

    await waitFor(() => expect(mockedApplyInventoryDeductions).toHaveBeenCalledWith([
      expect.objectContaining({ inventoryId: 20, quantity: 100, unit: "g" }),
    ]));
    expect(onCommitted).toHaveBeenCalledWith(loggedMeal, expect.stringContaining("Pantry updated"));
  });
});
