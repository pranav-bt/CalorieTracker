import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFoods, logMeal } from "../db";
import { RecipeNutritionCalculator } from "./RecipeNutritionCalculator";
import type { Food, MealSummary } from "../types";

jest.mock("../db", () => ({
  getFoods: jest.fn(),
  logMeal: jest.fn(),
}));

const mockedGetFoods = jest.mocked(getFoods);
const mockedLogMeal = jest.mocked(logMeal);

const foods: Food[] = [
  { id: 1, name: "chicken breast", unit: "g", reference_quantity: 100, reference_calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, source: "manual" },
  { id: 2, name: "rice", unit: "g", reference_quantity: 100, reference_calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fiber_g: 0.4, source: "manual" },
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
});
