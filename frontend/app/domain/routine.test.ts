import { currentWeekday, localDate, scaleFood, totalMeal, weekdayForLocalDate } from "./routine";
import type { Food } from "../types";

const oats: Food = {
  id: 1, name: "oats", unit: "g", reference_quantity: 100, reference_calories: 389,
  protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6, source: "manual",
};

describe("meal routine calculations", () => {
  it("scales a food reference and rounds a planned snapshot", () => {
    expect(scaleFood(oats, 50)).toEqual({
      name: "oats", quantity: 50, unit: "g", calories: 195,
      protein_g: 8.5, carbs_g: 33.2, fat_g: 3.5, fiber_g: 5.3,
    });
  });

  it("totals calories and macros across ingredients", () => {
    const first = scaleFood(oats, 50);
    expect(totalMeal([first, { ...first, calories: 70 }])).toEqual({
      total_calories: 265, protein_g: 17, carbs_g: 66.4, fat_g: 7, fiber_g: 10.6,
    });
  });

  it("uses Monday as weekday zero and formats local dates", () => {
    expect(currentWeekday(new Date(2026, 7, 24))).toBe(0);
    expect(localDate(new Date(2026, 7, 25))).toBe("2026-08-25");
    expect(weekdayForLocalDate("2026-08-25")).toBe(1);
  });

  it("rejects malformed and impossible local dates", () => {
    expect(() => weekdayForLocalDate("2026-02-30")).toThrow("valid local date");
    expect(() => weekdayForLocalDate("08/25/2026")).toThrow("valid local date");
  });

  it("rejects zero quantities", () => {
    expect(() => scaleFood(oats, 0)).toThrow("quantity above zero");
  });
});
