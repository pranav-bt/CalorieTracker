"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Pencil, Plus, Save, Trash2, Utensils, X } from "lucide-react";
import { getFoods } from "../db";
import { deleteRoutineMeal, getRoutineMeals, saveRoutineMeal } from "../db/routine";
import { getActiveNutritionPlan } from "../db/plans";
import { currentWeekday, scaleFood, totalMeal, WEEKDAYS } from "../domain/routine";
import type { Food, MealSlot, NutritionPlanDay, PlannedMeal } from "../types";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
type DraftRow = { foodId: string; quantity: string };

export default function RoutinePage() {
  const [weekday, setWeekday] = useState(currentWeekday());
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [targets, setTargets] = useState<NutritionPlanDay[]>([]);
  const [editing, setEditing] = useState<MealSlot | null>(null);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([{ foodId: "", quantity: "" }]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editorWarning, setEditorWarning] = useState("");
  const loadRequest = useRef(0);

  async function load() {
    const request = ++loadRequest.current;
    const [foodRows, planned, activePlan] = await Promise.all([getFoods(), getRoutineMeals(weekday), getActiveNutritionPlan()]);
    if (request !== loadRequest.current) return;
    setFoods(foodRows); setMeals(planned); setTargets(activePlan?.days ?? []);
  }
  useEffect(() => { setEditing(null); load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the routine.")); }, [weekday]);

  const previewItems = useMemo(() => rows.flatMap((row) => {
    const food = foods.find((item) => item.id === Number(row.foodId));
    const quantity = Number(row.quantity);
    return food && quantity > 0 ? [scaleFood(food, quantity)] : [];
  }), [foods, rows]);
  const preview = totalMeal(previewItems);

  function beginEdit(slot: MealSlot) {
    const meal = meals.find((item) => item.slot === slot);
    setEditing(slot); setName(meal?.name ?? "");
    const editable = meal?.items.filter((item) => item.food_id !== null).map((item) => ({ foodId: String(item.food_id), quantity: String(item.quantity) }));
    setRows(editable?.length ? editable : [{ foodId: "", quantity: "" }]);
    const missingCount = meal?.items.filter((item) => item.food_id === null).length ?? 0;
    setEditorWarning(missingCount ? `${missingCount} ingredient${missingCount === 1 ? " was" : "s were"} deleted from the food database. The saved dish remains unchanged unless you replace ${missingCount === 1 ? "it" : "them"} and save.` : "");
    setMessage(""); setError("");
  }

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  async function save() {
    if (!editing) return;
    setBusy(true); setMessage(""); setError("");
    try {
      await saveRoutineMeal({
        weekday, slot: editing, name,
        items: rows.map((row) => ({ food_id: Number(row.foodId), quantity: Number(row.quantity) })),
      });
      setEditing(null); setMessage(`${WEEKDAYS[weekday]} ${editing} saved.`); await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the planned meal.");
    } finally { setBusy(false); }
  }

  async function remove(meal: PlannedMeal) {
    if (!window.confirm(`Delete ${meal.name} from ${WEEKDAYS[weekday]} ${meal.slot}?`)) return;
    setBusy(true); setMessage(""); setError("");
    try { await deleteRoutineMeal(meal.id); setEditing(null); setMessage("Planned meal deleted."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete the planned meal."); }
    finally { setBusy(false); }
  }

  const dayTotal = totalMeal(meals.map((meal) => ({
    name: meal.name, quantity: 1, unit: "piece", calories: meal.total_calories,
    protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g, fiber_g: meal.fiber_g,
  })));
  const target = targets.find((day) => day.weekday === weekday);

  return (
    <section className="pageStack">
      <div className="pageHeader"><div><p className="eyebrow">Offline weekly planning</p><h1>Routine</h1></div><CalendarDays size={24} /></div>
      <p className="pageIntro">Name your usual breakfast, lunch, and dinner using foods already in your database. Plans repeat weekly and are never logged automatically.</p>
      <div className="weekdayTabs" role="tablist" aria-label="Routine weekday">
        {WEEKDAYS.map((day, index) => <button aria-selected={weekday === index} className={weekday === index ? "active" : ""} key={day} onClick={() => setWeekday(index)} role="tab" type="button"><span>{day.slice(0, 3)}</span><small>{day}</small></button>)}
      </div>
      <section className="routineDaySummary panel">
        <div><span className="metricLabel">{WEEKDAYS[weekday]} planned</span><strong>{dayTotal.total_calories} kcal</strong></div>
        <div><span>P {dayTotal.protein_g}g</span><span>C {dayTotal.carbs_g}g</span><span>F {dayTotal.fat_g}g</span><span>Fiber {dayTotal.fiber_g}g</span></div>
      </section>
      <section className="routineGoalGap panel">
        <span className="metricLabel">Still to plan for this day</span>
        {target ? <div><strong>{gapText(target.calories - dayTotal.total_calories, "kcal")}</strong><span>P {gapText(target.protein_g - dayTotal.protein_g, "g")}</span><span>C {gapText(target.carbs_g - dayTotal.carbs_g, "g")}</span><span>F {gapText(target.fat_g - dayTotal.fat_g, "g")}</span><span>Fiber {gapText(target.fiber_g - dayTotal.fiber_g, "g")}</span></div> : <p className="muted">Create a nutrition plan to compare these dishes with your weekday target.</p>}
      </section>
      <div className="routineSlotGrid">
        {SLOTS.map((slot) => {
          const meal = meals.find((item) => item.slot === slot);
          return <article className="panel routineSlotCard" key={slot}>
            <div className="panelHeader"><div><span className="routineSlot">{slot}</span><h2>{meal?.name ?? `Plan ${slot}`}</h2></div><Utensils size={19} /></div>
            {meal ? <><p>{meal.items.map((item) => `${item.quantity}${item.unit} ${item.name}`).join(" · ")}</p><strong>{meal.total_calories} kcal · P {meal.protein_g}g · C {meal.carbs_g}g · F {meal.fat_g}g</strong></> : <p className="muted">No dish saved for this slot.</p>}
            <div className="actionRow"><button className="secondaryButton" onClick={() => beginEdit(slot)} type="button">{meal ? <Pencil size={16} /> : <Plus size={16} />}{meal ? "Edit" : "Add dish"}</button>{meal && <button className="dangerButton" disabled={busy} onClick={() => remove(meal)} type="button"><Trash2 size={16} />Delete</button>}</div>
          </article>;
        })}
      </div>
      {editing && <section className="panel routineEditor">
        <div className="panelHeader"><div><p className="eyebrow">{WEEKDAYS[weekday]} · {editing}</p><h2>Planned dish</h2></div><button aria-label="Close editor" className="iconButton" onClick={() => setEditing(null)} type="button"><X size={18} /></button></div>
        <label className="stackedField"><span>Dish name</span><input autoFocus placeholder="e.g. Oats and eggs" value={name} onChange={(event) => setName(event.target.value)} /></label>
        {editorWarning && <p className="warningNotice">{editorWarning}</p>}
        <div className="routineIngredientRows">
          {rows.map((row, index) => {
            const food = foods.find((item) => item.id === Number(row.foodId));
            return <div className="routineIngredientRow" key={index}>
              <select aria-label={`Ingredient ${index + 1}`} value={row.foodId} onChange={(event) => updateRow(index, { foodId: event.target.value })}><option value="">Choose food</option>{foods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <input aria-label={`Quantity ${index + 1}`} min="0.01" placeholder="Qty" step="0.01" type="number" value={row.quantity} onChange={(event) => updateRow(index, { quantity: event.target.value })} />
              <span>{food?.unit ?? "unit"}</span>
              <button aria-label={`Remove ingredient ${index + 1}`} className="iconButton danger" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} type="button"><Trash2 size={16} /></button>
            </div>;
          })}
        </div>
        <button className="secondaryButton addRoutineIngredient" onClick={() => setRows((current) => [...current, { foodId: "", quantity: "" }])} type="button"><Plus size={16} />Add ingredient</button>
        <div className="routinePreview"><strong>{preview.total_calories} kcal</strong><span>P {preview.protein_g}g</span><span>C {preview.carbs_g}g</span><span>F {preview.fat_g}g</span><span>Fiber {preview.fiber_g}g</span></div>
        <div className="actionRow"><button className="secondaryButton" onClick={() => setEditing(null)} type="button">Cancel</button><button disabled={busy || foods.length === 0} onClick={save} type="button"><Save size={17} />{busy ? "Saving…" : "Save dish"}</button></div>
      </section>}
      {message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}
    </section>
  );
}

function gapText(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded >= 0 ? `${rounded}${unit}` : `${Math.abs(rounded)}${unit} over`;
}
