import { inventoryExpiryAlerts, inventoryExpiryStatus, planInventoryDeductions } from "./inventory";
import type { InventoryItem } from "../types";

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: 1,
    food_id: 10,
    name: "rice",
    quantity: 500,
    unit: "g",
    location: "pantry",
    expires_on: null,
    low_stock_quantity: null,
    updated_at: "2026-08-18T00:00:00Z",
    ...overrides,
  };
}

describe("inventory expiry", () => {
  it("distinguishes expired, today, soon, and unexpired stock", () => {
    expect(inventoryExpiryStatus("2026-08-17", "2026-08-18")).toBe("expired");
    expect(inventoryExpiryStatus("2026-08-18", "2026-08-18")).toBe("today");
    expect(inventoryExpiryStatus("2026-08-21", "2026-08-18")).toBe("soon");
    expect(inventoryExpiryStatus("2026-08-22", "2026-08-18")).toBe("none");
  });

  it("returns only positive-stock alerts, ordered by expiry", () => {
    const alerts = inventoryExpiryAlerts([
      item({ id: 1, name: "milk", expires_on: "2026-08-20" }),
      item({ id: 2, name: "yogurt", expires_on: "2026-08-17" }),
      item({ id: 3, name: "empty", quantity: 0, expires_on: "2026-08-18" }),
    ], "2026-08-18");
    expect(alerts.map((entry) => entry.name)).toEqual(["yogurt", "milk"]);
  });
});

describe("planInventoryDeductions", () => {
  it("aggregates usage and consumes earliest-expiring usable stock first", () => {
    const plan = planInventoryDeductions([
      { foodId: 10, name: "rice", quantity: 100, unit: "g" },
      { foodId: 10, name: "rice", quantity: 80, unit: "g" },
    ], [
      item({ id: 1, quantity: 100, expires_on: "2026-08-20" }),
      item({ id: 2, quantity: 200, expires_on: "2026-09-01", location: "freezer" }),
      item({ id: 3, quantity: 500, expires_on: "2026-08-17" }),
    ], "2026-08-18");

    expect(plan.deductions).toEqual([
      expect.objectContaining({ inventoryId: 1, quantity: 100 }),
      expect.objectContaining({ inventoryId: 2, quantity: 80 }),
    ]);
    expect(plan.shortages).toEqual([]);
    expect(plan.totalMatchedIngredients).toBe(1);
  });

  it("reports partial availability and matches by name when no food id is linked", () => {
    const plan = planInventoryDeductions([
      { name: "Oats", quantity: 150, unit: "g" },
    ], [item({ food_id: null, name: "oats", quantity: 90 })], "2026-08-18");

    expect(plan.deductions[0]).toMatchObject({ quantity: 90, name: "oats" });
    expect(plan.shortages).toEqual([{ name: "oats", requested: 150, available: 90, unit: "g" }]);
  });
});
