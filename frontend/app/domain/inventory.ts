import type { InventoryItem, Unit } from "../types";

export type InventoryExpiryStatus = "none" | "expired" | "today" | "soon";

export type InventoryUsage = {
  foodId?: number | null;
  name: string;
  quantity: number;
  unit: Unit;
};

export type InventoryDeduction = {
  inventoryId: number;
  name: string;
  quantity: number;
  unit: Unit;
  location: InventoryItem["location"];
  expiresOn: string | null;
};

export type InventoryShortage = {
  name: string;
  requested: number;
  available: number;
  unit: Unit;
};

export type InventoryDeductionPlan = {
  deductions: InventoryDeduction[];
  shortages: InventoryShortage[];
  totalMatchedIngredients: number;
};

export function inventoryExpiryStatus(
  expiresOn: string | null,
  today = localDate(),
  soonDays = 3
): InventoryExpiryStatus {
  if (!expiresOn) return "none";
  const days = daysBetween(today, expiresOn);
  if (days < 0) return "expired";
  if (days === 0) return "today";
  return days <= soonDays ? "soon" : "none";
}

export function inventoryExpiryAlerts(items: InventoryItem[], today = localDate()): InventoryItem[] {
  return items
    .filter((item) => item.quantity > 0 && inventoryExpiryStatus(item.expires_on, today) !== "none")
    .sort((left, right) => (left.expires_on ?? "9999-12-31").localeCompare(right.expires_on ?? "9999-12-31"));
}

export function planInventoryDeductions(
  usages: InventoryUsage[],
  inventory: InventoryItem[],
  today = localDate()
): InventoryDeductionPlan {
  const requested = aggregateUsage(usages);
  const deductions: InventoryDeduction[] = [];
  const shortages: InventoryShortage[] = [];
  let totalMatchedIngredients = 0;

  requested.forEach((usage) => {
    let remaining = usage.quantity;
    const candidates = inventory
      .filter((item) => item.quantity > 0)
      .filter((item) => inventoryExpiryStatus(item.expires_on, today) !== "expired")
      .filter((item) => item.unit === usage.unit)
      .filter((item) => {
        if (usage.foodId !== null && usage.foodId !== undefined && item.food_id !== null) {
          return item.food_id === usage.foodId;
        }
        return normalize(item.name) === normalize(usage.name);
      })
      .sort((left, right) => {
        const leftExpiry = left.expires_on ?? "9999-12-31";
        const rightExpiry = right.expires_on ?? "9999-12-31";
        return leftExpiry.localeCompare(rightExpiry) || left.id - right.id;
      });

    const available = roundQuantity(candidates.reduce((sum, item) => sum + item.quantity, 0));
    if (candidates.length) totalMatchedIngredients += 1;
    for (const item of candidates) {
      if (remaining <= 0) break;
      const quantity = roundQuantity(Math.min(remaining, item.quantity));
      if (quantity <= 0) continue;
      deductions.push({
        inventoryId: item.id,
        name: item.name,
        quantity,
        unit: item.unit,
        location: item.location,
        expiresOn: item.expires_on,
      });
      remaining = roundQuantity(remaining - quantity);
    }
    if (remaining > 0) {
      shortages.push({
        name: usage.name,
        requested: usage.quantity,
        available,
        unit: usage.unit,
      });
    }
  });

  return { deductions, shortages, totalMatchedIngredients };
}

function aggregateUsage(usages: InventoryUsage[]): InventoryUsage[] {
  const totals = new Map<string, InventoryUsage>();
  usages.forEach((usage) => {
    if (!Number.isFinite(usage.quantity) || usage.quantity <= 0) return;
    const identity = usage.foodId !== null && usage.foodId !== undefined
      ? `food:${usage.foodId}:${usage.unit}`
      : `name:${normalize(usage.name)}:${usage.unit}`;
    const current = totals.get(identity);
    totals.set(identity, current
      ? { ...current, quantity: roundQuantity(current.quantity + usage.quantity) }
      : { ...usage, name: normalize(usage.name), quantity: roundQuantity(usage.quantity) });
  });
  return [...totals.values()];
}

function daysBetween(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  return Math.round((endTime - startTime) / 86_400_000);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
