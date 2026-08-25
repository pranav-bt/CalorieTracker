import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoutinePage from "./page";
import { getFoods } from "../db";
import { getActiveNutritionPlan } from "../db/plans";
import { getRoutineMeals, saveRoutineMeal } from "../db/routine";

jest.mock("../db", () => ({ getFoods: jest.fn() }));
jest.mock("../db/plans", () => ({ getActiveNutritionPlan: jest.fn() }));
jest.mock("../db/routine", () => ({ getRoutineMeals: jest.fn(), saveRoutineMeal: jest.fn(), deleteRoutineMeal: jest.fn() }));

describe("Routine page", () => {
  beforeEach(() => {
    jest.mocked(getFoods).mockResolvedValue([{ id: 2, name: "oats", unit: "g", reference_quantity: 100, reference_calories: 400, protein_g: 20, carbs_g: 60, fat_g: 8, fiber_g: 10, source: "manual" }]);
    jest.mocked(getRoutineMeals).mockResolvedValue([]);
    jest.mocked(getActiveNutritionPlan).mockResolvedValue(null);
    jest.mocked(saveRoutineMeal).mockResolvedValue(9);
  });

  it("builds and saves a named dish without logging it", async () => {
    const user = userEvent.setup();
    render(<RoutinePage />);
    expect(await screen.findAllByText("No dish saved for this slot.")).toHaveLength(3);
    const addButtons = screen.getAllByRole("button", { name: /add dish/i });
    await user.click(addButtons[0]);
    await user.type(screen.getByLabelText("Dish name"), "Oat bowl");
    await user.selectOptions(screen.getByLabelText("Ingredient 1"), "2");
    await user.type(screen.getByLabelText("Quantity 1"), "50");
    expect(screen.getByText("200 kcal")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save dish/i }));
    await waitFor(() => expect(saveRoutineMeal).toHaveBeenCalledWith(expect.objectContaining({
      name: "Oat bowl", slot: "breakfast", items: [{ food_id: 2, quantity: 50 }],
    })));
    expect(screen.queryByRole("button", { name: /log meal/i })).not.toBeInTheDocument();
  });
});
