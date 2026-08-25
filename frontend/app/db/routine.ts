"use client";

import { Capacitor } from "@capacitor/core";
import { getDb, inTransaction } from "./client";
import { localDate, totalMeal } from "../domain/routine";
import type { MealItem, MealSlot, PlannedMeal, PlannedMealDraft, PlannedMealItem, Unit } from "../types";

function requireAndroid(): void {
  if (!Capacitor.isNativePlatform()) throw new Error("Meal routines are available in the Android app.");
}

function validSlot(slot: string): slot is MealSlot {
  return slot === "breakfast" || slot === "lunch" || slot === "dinner";
}

function validateDraft(draft: PlannedMealDraft): void {
  if (!Number.isInteger(draft.weekday) || draft.weekday < 0 || draft.weekday > 6) throw new Error("Choose a valid weekday.");
  if (!validSlot(draft.slot)) throw new Error("Choose breakfast, lunch, or dinner.");
  if (!draft.name.trim()) throw new Error("Give the planned dish a name.");
  if (!draft.items.length) throw new Error("Add at least one ingredient.");
  if (draft.items.some((item) => !Number.isInteger(item.food_id) || item.food_id <= 0 || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    throw new Error("Every ingredient needs a food and a quantity above zero.");
  }
}

export async function getRoutineMeals(weekday?: number, loggedOn = localDate()): Promise<PlannedMeal[]> {
  if (!Capacitor.isNativePlatform()) return [];
  const db = await getDb();
  const params: unknown[] = [loggedOn];
  const where = weekday === undefined ? "" : "WHERE p.weekday=?";
  if (weekday !== undefined) params.push(weekday);
  const { values } = await db.query(
    `SELECT p.id, p.weekday, p.slot, p.name, p.total_calories, p.protein_g, p.carbs_g, p.fat_g, p.fiber_g,
            l.meal_id AS logged_meal_id
       FROM planned_meals p
       LEFT JOIN planned_meal_logs l ON l.planned_meal_id=p.id AND l.logged_on=?
       ${where}
       ORDER BY p.weekday,
         CASE p.slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 ELSE 2 END`,
    params
  );

  const result: PlannedMeal[] = [];
  for (const row of values ?? []) {
    const { values: itemRows } = await db.query(
      `SELECT id, food_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g
         FROM planned_meal_items WHERE planned_meal_id=? ORDER BY order_index, id`,
      [row.id]
    );
    result.push({
      id: row.id as number,
      weekday: row.weekday as number,
      slot: row.slot as MealSlot,
      name: row.name as string,
      total_calories: Number(row.total_calories),
      protein_g: Number(row.protein_g),
      carbs_g: Number(row.carbs_g),
      fat_g: Number(row.fat_g),
      fiber_g: Number(row.fiber_g),
      logged_meal_id: row.logged_meal_id == null ? null : Number(row.logged_meal_id),
      items: (itemRows ?? []).map((item): PlannedMealItem => ({
        id: item.id as number,
        food_id: item.food_id == null ? null : Number(item.food_id),
        name: item.name as string,
        quantity: Number(item.quantity),
        unit: item.unit as Unit,
        calories: Number(item.calories),
        protein_g: Number(item.protein_g),
        carbs_g: Number(item.carbs_g),
        fat_g: Number(item.fat_g),
        fiber_g: Number(item.fiber_g),
      })),
    });
  }
  return result;
}

export async function saveRoutineMeal(draft: PlannedMealDraft): Promise<number> {
  requireAndroid();
  validateDraft(draft);
  const db = await getDb();
  return inTransaction(db, async () => {
    const calculated: Array<MealItem & { food_id: number }> = [];
    for (const item of draft.items) {
      const { values } = await db.query(
        `SELECT id, name, unit, reference_quantity, reference_calories, protein_g, carbs_g, fat_g, fiber_g
           FROM foods WHERE id=?`,
        [item.food_id]
      );
      const food = values?.[0];
      if (!food) throw new Error("A selected food no longer exists. Refresh the routine and choose another food.");
      const ratio = item.quantity / Number(food.reference_quantity);
      const oneDecimal = (value: number) => Math.round(value * 10) / 10;
      calculated.push({
        food_id: Number(food.id), name: food.name as string, quantity: item.quantity, unit: food.unit as Unit,
        calories: Math.round(Number(food.reference_calories) * ratio),
        protein_g: oneDecimal(Number(food.protein_g) * ratio), carbs_g: oneDecimal(Number(food.carbs_g) * ratio),
        fat_g: oneDecimal(Number(food.fat_g) * ratio), fiber_g: oneDecimal(Number(food.fiber_g) * ratio),
      });
    }
    const totals = totalMeal(calculated);
    await db.run(
      `INSERT INTO planned_meals (weekday, slot, name, total_calories, protein_g, carbs_g, fat_g, fiber_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(weekday, slot) DO UPDATE SET
         name=excluded.name, total_calories=excluded.total_calories, protein_g=excluded.protein_g,
         carbs_g=excluded.carbs_g, fat_g=excluded.fat_g, fiber_g=excluded.fiber_g, updated_at=datetime('now')`,
      [draft.weekday, draft.slot, draft.name.trim(), totals.total_calories, totals.protein_g, totals.carbs_g, totals.fat_g, totals.fiber_g],
      false
    );
    const { values: rows } = await db.query("SELECT id FROM planned_meals WHERE weekday=? AND slot=?", [draft.weekday, draft.slot]);
    const plannedMealId = Number(rows?.[0]?.id);
    await db.run("DELETE FROM planned_meal_items WHERE planned_meal_id=?", [plannedMealId], false);
    for (const [index, item] of calculated.entries()) {
      await db.run(
        `INSERT INTO planned_meal_items
          (planned_meal_id, food_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [plannedMealId, item.food_id, item.name, item.quantity, item.unit, item.calories, item.protein_g, item.carbs_g, item.fat_g, item.fiber_g, index],
        false
      );
    }
    return plannedMealId;
  });
}

export async function deleteRoutineMeal(id: number): Promise<void> {
  requireAndroid();
  const db = await getDb();
  await inTransaction(db, async () => {
    await db.run("DELETE FROM planned_meal_logs WHERE planned_meal_id=?", [id], false);
    await db.run("DELETE FROM planned_meal_items WHERE planned_meal_id=?", [id], false);
    const { changes } = await db.run("DELETE FROM planned_meals WHERE id=?", [id], false);
    if (!changes?.changes) throw new Error("Planned meal not found.");
  });
}

export async function logRoutineMeal(id: number, loggedOn = localDate()): Promise<number> {
  requireAndroid();
  const db = await getDb();
  return inTransaction(db, async () => {
    const { values: existing } = await db.query(
      "SELECT meal_id FROM planned_meal_logs WHERE planned_meal_id=? AND logged_on=?",
      [id, loggedOn]
    );
    if (existing?.length) throw new Error("This planned meal is already logged today.");
    const { values: planRows } = await db.query("SELECT * FROM planned_meals WHERE id=?", [id]);
    const plan = planRows?.[0];
    if (!plan) throw new Error("Planned meal not found.");
    const { values: items } = await db.query(
      `SELECT name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g
         FROM planned_meal_items WHERE planned_meal_id=? ORDER BY order_index, id`,
      [id]
    );
    if (!items?.length) throw new Error("This planned meal has no ingredients.");
    const { changes } = await db.run(
      `INSERT INTO meals (date, meal_type, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [loggedOn, plan.slot, plan.total_calories, plan.protein_g, plan.carbs_g, plan.fat_g, plan.fiber_g],
      false
    );
    const mealId = Number(changes?.lastId);
    for (const item of items) {
      await db.run(
        `INSERT INTO meal_items (meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mealId, item.name, item.quantity, item.unit, item.calories, item.protein_g, item.carbs_g, item.fat_g, item.fiber_g],
        false
      );
    }
    await db.run(
      "INSERT INTO planned_meal_logs (planned_meal_id, meal_id, logged_on) VALUES (?, ?, ?)",
      [id, mealId, loggedOn],
      false
    );
    await db.run("INSERT INTO heart_points_log (source, points) VALUES ('log_meal', 1)", [], false);
    return mealId;
  });
}
