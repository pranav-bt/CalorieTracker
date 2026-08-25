import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodayRoutineMeals } from "./TodayRoutineMeals";
import { getRoutineMeals, logRoutineMeal } from "../db/routine";

jest.mock("next/link", () => function Link({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href}>{children}</a>; });
jest.mock("../db/routine", () => ({ getRoutineMeals: jest.fn(), logRoutineMeal: jest.fn() }));

const meal = { id: 9, weekday: 1, slot: "breakfast" as const, name: "Oat bowl", total_calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4, fiber_g: 5, logged_meal_id: null, items: [] };

describe("Today's routine", () => {
  it("logs only after the user explicitly presses Log meal", async () => {
    const user = userEvent.setup();
    jest.mocked(getRoutineMeals).mockResolvedValueOnce([meal]).mockResolvedValueOnce([{ ...meal, logged_meal_id: 12 }]);
    jest.mocked(logRoutineMeal).mockResolvedValue(12);
    const refreshed = jest.fn();
    render(<TodayRoutineMeals onLogged={refreshed} />);
    expect(await screen.findByText("Oat bowl")).toBeInTheDocument();
    expect(logRoutineMeal).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Log meal" }));
    await waitFor(() => expect(logRoutineMeal).toHaveBeenCalledWith(9));
    expect(await screen.findByText("Logged")).toBeInTheDocument();
    expect(refreshed).toHaveBeenCalled();
  });
});
