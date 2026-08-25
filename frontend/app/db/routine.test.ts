import { Capacitor } from "@capacitor/core";
import { getDb, inTransaction } from "./client";
import { getRoutineMeals, logRoutineMeal, saveRoutineMeal } from "./routine";

jest.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: jest.fn() } }));
jest.mock("./client", () => ({ getDb: jest.fn(), inTransaction: jest.fn() }));

const mockedGetDb = jest.mocked(getDb);
const mockedTransaction = jest.mocked(inTransaction);

describe("routine persistence", () => {
  beforeEach(() => {
    jest.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    mockedTransaction.mockImplementation(async (_db, operation) => operation());
  });

  it("stores authoritative nutrition snapshots for a weekday slot", async () => {
    const db = {
      run: jest.fn().mockResolvedValue({ changes: { changes: 1, lastId: 4 } }),
      query: jest.fn()
        .mockResolvedValueOnce({ values: [{ id: 2, name: "oats", unit: "g", reference_quantity: 100, reference_calories: 400, protein_g: 20, carbs_g: 60, fat_g: 8, fiber_g: 10 }] })
        .mockResolvedValueOnce({ values: [{ id: 9 }] }),
    };
    mockedGetDb.mockResolvedValue(db as never);

    await expect(saveRoutineMeal({ weekday: 1, slot: "breakfast", name: "Oat bowl", items: [{ food_id: 2, quantity: 50 }] })).resolves.toBe(9);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO planned_meals"), expect.arrayContaining([200, 10, 30, 4, 5]), false);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO planned_meal_items"), expect.arrayContaining([9, 2, "oats", 50, "g", 200]), false);
  });

  it("restores planned items and today's logged state", async () => {
    const db = { query: jest.fn()
      .mockResolvedValueOnce({ values: [{ id: 9, weekday: 1, slot: "breakfast", name: "Oat bowl", total_calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4, fiber_g: 5, logged_meal_id: 12 }] })
      .mockResolvedValueOnce({ values: [{ id: 10, food_id: 2, name: "oats", quantity: 50, unit: "g", calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4, fiber_g: 5 }] }) };
    mockedGetDb.mockResolvedValue(db as never);
    const result = await getRoutineMeals(1, "2026-08-25");
    expect(result[0]).toMatchObject({ id: 9, logged_meal_id: 12, items: [{ name: "oats", calories: 200 }] });
  });

  it("logs the saved snapshots exactly once for a date", async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({ values: [] })
        .mockResolvedValueOnce({ values: [{ id: 9, slot: "breakfast", total_calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4, fiber_g: 5 }] })
        .mockResolvedValueOnce({ values: [{ name: "oats", quantity: 50, unit: "g", calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4, fiber_g: 5 }] }),
      run: jest.fn().mockResolvedValueOnce({ changes: { changes: 1, lastId: 12 } }).mockResolvedValue({ changes: { changes: 1 } }),
    };
    mockedGetDb.mockResolvedValue(db as never);
    await expect(logRoutineMeal(9, "2026-08-25")).resolves.toBe(12);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO meals"), ["2026-08-25", "breakfast", 200, 10, 30, 4, 5], false);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("planned_meal_logs"), [9, 12, "2026-08-25"], false);
  });

  it("prevents duplicate logging", async () => {
    const db = { query: jest.fn().mockResolvedValue({ values: [{ meal_id: 12 }] }), run: jest.fn() };
    mockedGetDb.mockResolvedValue(db as never);
    await expect(logRoutineMeal(9, "2026-08-25")).rejects.toThrow("already logged");
    expect(db.run).not.toHaveBeenCalled();
  });
});
