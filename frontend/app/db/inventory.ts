"use client";

import { Capacitor } from "@capacitor/core";
import type { InventoryItem, Unit } from "../types";
import { getDb } from "./client";

export type InventoryDraft = Omit<InventoryItem, "id" | "updated_at">;

function requireAndroid(): void {
  if (!Capacitor.isNativePlatform()) throw new Error("Inventory storage is available in the Android app.");
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query(
    `SELECT id, food_id, name, quantity, unit, location, expires_on,
            low_stock_quantity, updated_at
     FROM inventory_items
     ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END, expires_on, name`
  );
  return (values ?? []).map((row) => ({
    id: row.id as number,
    food_id: row.food_id as number | null,
    name: row.name as string,
    quantity: row.quantity as number,
    unit: row.unit as Unit,
    location: row.location as InventoryItem["location"],
    expires_on: row.expires_on as string | null,
    low_stock_quantity: row.low_stock_quantity as number | null,
    updated_at: row.updated_at as string,
  }));
}

export async function saveInventoryItem(draft: InventoryDraft, id?: number): Promise<number> {
  requireAndroid();
  const db = await getDb();
  const name = draft.name.trim().toLowerCase();
  if (!name) throw new Error("Ingredient name is required.");
  if (!Number.isFinite(draft.quantity) || draft.quantity < 0) throw new Error("Quantity must be zero or more.");
  if (draft.low_stock_quantity !== null && draft.low_stock_quantity < 0) {
    throw new Error("Low-stock quantity must be zero or more.");
  }
  if (id) {
    const { changes } = await db.run(
      `UPDATE inventory_items SET
         food_id=?, name=?, quantity=?, unit=?, location=?, expires_on=?,
         low_stock_quantity=?, updated_at=datetime('now')
       WHERE id=?`,
      [
        draft.food_id, name, draft.quantity, draft.unit, draft.location,
        draft.expires_on, draft.low_stock_quantity, id,
      ]
    );
    if (!changes?.changes) throw new Error("Inventory item not found.");
    return id;
  }
  const { changes } = await db.run(
    `INSERT INTO inventory_items (
       food_id, name, quantity, unit, location, expires_on, low_stock_quantity
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.food_id, name, draft.quantity, draft.unit, draft.location,
      draft.expires_on, draft.low_stock_quantity,
    ]
  );
  return changes?.lastId as number;
}

export async function adjustInventoryQuantity(id: number, delta: number): Promise<void> {
  requireAndroid();
  const db = await getDb();
  const { changes } = await db.run(
    `UPDATE inventory_items
     SET quantity=MAX(0, quantity + ?), updated_at=datetime('now')
     WHERE id=?`,
    [delta, id]
  );
  if (!changes?.changes) throw new Error("Inventory item not found.");
}

export async function deleteInventoryItem(id: number): Promise<void> {
  requireAndroid();
  const db = await getDb();
  await db.run("DELETE FROM inventory_items WHERE id=?", [id]);
}
