"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { deleteMeal, getFoods, getMeals, logMeal } from "../db";
import { MilestonePopup } from "../components/MilestonePopup";
import { HeartPointsToast } from "../components/HeartPointsToast";
import type { Food, MealRecord, MealRow, MealSummary, Unit } from "../types";

const emptyMealRow: MealRow = { name: "", quantity: "1", unit: "piece" };

export default function LogMealPage() {
  const [mealRows, setMealRows] = useState<MealRow[]>([emptyMealRow]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealRecord[]>([]);
  const [error, setError] = useState("");
  const [lastMeal, setLastMeal] = useState<MealSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [heartPointsEarned, setHeartPointsEarned] = useState<number | null>(null);

  async function refreshData() {
    const [foodsData, mealsData] = await Promise.all([getFoods(), getMeals()]);
    setFoods(foodsData);
    setTodayMeals(mealsData);
  }

  useEffect(() => {
    refreshData().catch(() => setError("Could not load data."));
  }, []);

  function updateMealRow(index: number, updates: Partial<MealRow>) {
    setMealRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  }

  function updateMealFood(index: number, name: string) {
    const food = foods.find((f) => f.name === name.trim().toLowerCase());
    updateMealRow(index, { name, unit: food?.unit ?? mealRows[index].unit });
  }

  async function submitMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const validationError = validateMealRows(mealRows, foods);
    if (validationError) { setError(validationError); return; }

    setIsLoading(true);
    try {
      const meal = await logMeal(
        mealRows.map((r) => ({
          name: r.name.trim().toLowerCase(),
          quantity: Number(r.quantity),
          unit: r.unit,
        }))
      );
      setLastMeal(meal);
      if (meal.milestone) setMilestoneToast(meal.milestone);
      if (meal.heart_points_earned > 0) setHeartPointsEarned(meal.heart_points_earned);
      setMealRows([emptyMealRow]);
      await refreshData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log meal.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteMeal(mealId: number) {
    setError("");
    try {
      await deleteMeal(mealId);
      if (lastMeal?.id === mealId) setLastMeal(null);
      await refreshData();
    } catch {
      setError("Could not delete meal.");
    }
  }

  return (
    <section className="pageStack">
      {milestoneToast && (
        <MilestonePopup message={milestoneToast} onDismiss={() => setMilestoneToast(null)} />
      )}
      {heartPointsEarned !== null && (
        <HeartPointsToast points={heartPointsEarned} onDismiss={() => setHeartPointsEarned(null)} />
      )}
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Today only</p>
          <h1>Log Meal</h1>
        </div>
      </div>

      <form className="logForm" onSubmit={submitMeal}>
        <div className="panelHeader">
          <h2>Meal items</h2>
          <Plus size={18} />
        </div>
        <div className="mealTable">
          <datalist id="known-foods">
            {foods.map((food) => (
              <option key={food.id} value={food.name} />
            ))}
          </datalist>
          <div className="tableHead">
            <span>Food</span>
            <span>Quantity</span>
            <span>Unit</span>
            <span />
          </div>
          {mealRows.map((row, index) => (
            <div className="tableRow" key={`meal-row-${index}`}>
              <input
                aria-label={`Food ${index + 1}`}
                autoComplete="off"
                list="known-foods"
                placeholder="Start typing a food"
                value={row.name}
                onChange={(e) => updateMealFood(index, e.target.value)}
                onBlur={(e) => updateMealFood(index, e.target.value)}
              />
              <input
                aria-label={`Quantity ${index + 1}`}
                min="0.01"
                step="0.01"
                type="number"
                value={row.quantity}
                onChange={(e) => updateMealRow(index, { quantity: e.target.value })}
              />
              <select
                aria-label={`Unit ${index + 1}`}
                value={row.unit}
                onChange={(e) => updateMealRow(index, { unit: e.target.value as Unit })}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="piece">piece</option>
                <option value="slice">slice</option>
              </select>
              <button
                className="iconButton danger"
                disabled={mealRows.length === 1}
                onClick={() => setMealRows((rows) => rows.filter((_, i) => i !== index))}
                title="Remove row"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="actionRow">
          <button type="button" onClick={() => setMealRows((rows) => [...rows, { ...emptyMealRow }])}>
            <Plus size={18} />
            Add row
          </button>
          <button disabled={isLoading || foods.length === 0} type="submit">
            <Save size={18} />
            Log meal
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </form>

      {lastMeal && (
        <section className="panel">
          <div className="panelHeader">
            <h2>Last meal</h2>
            <button
              className="iconButton danger"
              onClick={() => handleDeleteMeal(lastMeal.id)}
              title="Delete last meal"
            >
              <Trash2 size={17} />
            </button>
          </div>
          <MealItems meal={lastMeal} />
        </section>
      )}

      <section className="panel">
        <div className="panelHeader">
          <h2>Today&apos;s meals</h2>
        </div>
        {todayMeals.length ? (
          <ul className="mealList">
            {todayMeals.map((meal) => (
              <li key={meal.id}>
                <div>
                  <strong>{meal.total_calories}</strong>
                  <MealItems meal={meal} compact />
                </div>
                <button
                  className="iconButton danger"
                  onClick={() => handleDeleteMeal(meal.id)}
                  title="Delete meal"
                >
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No meals logged today.</p>
        )}
      </section>
    </section>
  );
}

function validateMealRows(rows: MealRow[], foods: Food[]): string | null {
  const known = new Set(foods.map((f) => f.name));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = rows.length > 1 ? `Row ${i + 1}: ` : "";
    if (!row.name.trim()) return `${label}Please enter a food name.`;
    if (!known.has(row.name.trim().toLowerCase()))
      return `${label}"${row.name}" is not in your food database. Add it first.`;
    const qty = Number(row.quantity);
    if (!row.quantity || isNaN(qty) || qty <= 0)
      return `${label}Quantity must be greater than zero.`;
  }
  return null;
}

function MealItems({
  meal,
  compact = false,
}: {
  meal: Pick<MealRecord, "items" | "total_calories">;
  compact?: boolean;
}) {
  return (
    <>
      <ul className={compact ? "inlineItems" : "items"}>
        {meal.items.map((item, idx) => (
          <li key={idx}>
            <span>
              {item.quantity} {item.unit} {item.name}
            </span>
            {!compact ? <strong>{item.calories}</strong> : null}
          </li>
        ))}
      </ul>
      {!compact && (
        <div className="totalLine">
          <span>Total</span>
          <strong>{meal.total_calories}</strong>
        </div>
      )}
    </>
  );
}
