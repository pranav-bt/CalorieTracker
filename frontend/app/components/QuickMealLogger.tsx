"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { getFoods, logMeal } from "../db";
import type { Food, MealRow, Unit } from "../types";

const EMPTY_ROW: MealRow = { name: "", quantity: "", unit: "g" };

export function QuickMealLogger({ onLogged }: { onLogged: () => Promise<void> | void }) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [rows, setRows] = useState<MealRow[]>([{ ...EMPTY_ROW }]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getFoods().then(setFoods).catch(() => setError("Could not load the food database."));
  }, []);

  function updateRow(index: number, patch: Partial<MealRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function updateFood(index: number, value: string) {
    const normalized = value.trim().toLowerCase();
    const food = foods.find((item) => item.name === normalized);
    updateRow(index, { name: value, ...(food ? { unit: food.unit } : {}) });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    for (const [index, row] of rows.entries()) {
      if (!foods.some((food) => food.name === row.name.trim().toLowerCase())) {
        setError(`${rows.length > 1 ? `Row ${index + 1}: ` : ""}Choose a food from your local database.`);
        return;
      }
      if (!row.quantity || Number(row.quantity) <= 0) {
        setError(`${rows.length > 1 ? `Row ${index + 1}: ` : ""}Quantity must be greater than zero.`);
        return;
      }
    }
    setIsSaving(true);
    try {
      const meal = await logMeal(rows.map((row) => ({
        name: row.name,
        quantity: Number(row.quantity),
        unit: row.unit,
      })));
      setRows([{ ...EMPTY_ROW }]);
      setMessage(`Added ${meal.total_calories} kcal to today.`);
      await onLogged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log the meal.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel quickMealForm" onSubmit={submit}>
      <div className="panelHeader"><h2>What did you eat?</h2><Plus size={18} /></div>
      <datalist id="quick-known-foods">{foods.map((food) => <option key={food.id} value={food.name} />)}</datalist>
      <div className="quickMealRows">
        {rows.map((row, index) => (
          <div className="quickMealRow" key={index}>
            <input aria-label={`Quick food ${index + 1}`} list="quick-known-foods" placeholder="Food" value={row.name} onBlur={(e) => updateFood(index, e.target.value)} onChange={(e) => updateFood(index, e.target.value)} />
            <input aria-label={`Quick quantity ${index + 1}`} min="0.01" placeholder="Qty" step="0.01" type="number" value={row.quantity} onChange={(e) => updateRow(index, { quantity: e.target.value })} />
            <select aria-label={`Quick unit ${index + 1}`} value={row.unit} onChange={(e) => updateRow(index, { unit: e.target.value as Unit })}>
              <option value="g">g</option><option value="ml">ml</option><option value="piece">piece</option><option value="slice">slice</option>
            </select>
            <button className="iconButton danger" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} title="Remove food" type="button"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <div className="actionRow">
        <button className="secondaryButton" onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])} type="button"><Plus size={17} />Add food</button>
        <button disabled={isSaving || foods.length === 0} type="submit"><Save size={17} />Add to today</button>
      </div>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
