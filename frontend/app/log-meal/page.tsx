"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { API_BASE_URL } from "../config";
import type { Food, MealRecord, MealRow, MealSummary, Unit } from "../types";

const emptyMealRow: MealRow = { name: "", quantity: "1", unit: "piece" };

export default function LogMealPage() {
  const [mealRows, setMealRows] = useState<MealRow[]>([emptyMealRow]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealRecord[]>([]);
  const [error, setError] = useState("");
  const [lastMeal, setLastMeal] = useState<MealSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function refreshData() {
    const [foodsResponse, mealsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/foods`),
      fetch(`${API_BASE_URL}/meals`),
    ]);

    if (foodsResponse.ok) {
      setFoods(await foodsResponse.json());
    }

    if (mealsResponse.ok) {
      setTodayMeals(await mealsResponse.json());
    }
  }

  useEffect(() => {
    refreshData().catch(() => setError("Backend is not reachable."));
  }, []);

  function updateMealRow(index: number, updates: Partial<MealRow>) {
    setMealRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...updates } : row,
      ),
    );
  }

  function updateMealFood(index: number, name: string) {
    const normalizedName = name.trim().toLowerCase();
    const food = foods.find((knownFood) => knownFood.name === normalizedName);
    updateMealRow(index, {
      name,
      unit: food?.unit ?? mealRows[index].unit,
    });
  }

  async function submitMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/log-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: mealRows.map((row) => ({
            name: row.name,
            quantity: Number(row.quantity),
            unit: row.unit,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Could not log meal.");
      }

      setLastMeal(await response.json());
      setMealRows([emptyMealRow]);
      await refreshData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log meal.");
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteMeal(mealId: number) {
    setError("");
    const response = await fetch(`${API_BASE_URL}/meal/${mealId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError("Could not delete meal.");
      return;
    }

    if (lastMeal?.id === mealId) {
      setLastMeal(null);
    }
    await refreshData();
  }

  return (
    <section className="pageStack">
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
                onChange={(event) => updateMealFood(index, event.target.value)}
                onBlur={(event) => updateMealFood(index, event.target.value)}
              />
              <input
                aria-label={`Quantity ${index + 1}`}
                min="0.01"
                step="0.01"
                type="number"
                value={row.quantity}
                onChange={(event) => updateMealRow(index, { quantity: event.target.value })}
              />
              <select
                aria-label={`Unit ${index + 1}`}
                value={row.unit}
                onChange={(event) => updateMealRow(index, { unit: event.target.value as Unit })}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="piece">piece</option>
                <option value="slice">slice</option>
              </select>
              <button
                className="iconButton danger"
                disabled={mealRows.length === 1}
                onClick={() => setMealRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                title="Remove row"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="actionRow">
          <button
            type="button"
            onClick={() => setMealRows((rows) => [...rows, { ...emptyMealRow }])}
          >
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

      {lastMeal ? (
        <section className="panel">
          <div className="panelHeader">
            <h2>Last meal</h2>
            <button
              className="iconButton danger"
              onClick={() => deleteMeal(lastMeal.id)}
              title="Delete last meal"
            >
              <Trash2 size={17} />
            </button>
          </div>
          <MealItems meal={lastMeal} />
        </section>
      ) : null}

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
                  onClick={() => deleteMeal(meal.id)}
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
        {meal.items.map((item) => (
          <li key={`${item.name}-${item.unit}-${item.quantity}`}>
            <span>
              {item.quantity} {item.unit} {item.name}
            </span>
            {!compact ? <strong>{item.calories}</strong> : null}
          </li>
        ))}
      </ul>
      {!compact ? (
        <div className="totalLine">
          <span>Total</span>
          <strong>{meal.total_calories}</strong>
        </div>
      ) : null}
    </>
  );
}

