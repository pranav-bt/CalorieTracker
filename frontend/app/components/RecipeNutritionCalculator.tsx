"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Plus, Save, Trash2, X } from "lucide-react";
import { getDailyMacroSummary, getDailySummary, getFoods, logMeal } from "../db";
import { calculateRecipeNutrition, remainingNutrition, type NutritionTotals } from "../domain/recipeNutrition";
import type { DailySummary, Food, MealSummary } from "../types";

type IngredientRow = {
  key: number;
  foodId: string;
  quantity: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCommitted: (meal: MealSummary) => void;
};

type GoalContext = {
  target: NutritionTotals;
  consumed: NutritionTotals;
  hasMacroTarget: boolean;
  source: DailySummary["target_source"];
  dayKind: DailySummary["plan_day_kind"];
};

export function RecipeNutritionCalculator({ isOpen, onClose, onCommitted }: Props) {
  const nextKey = useRef(2);
  const [foods, setFoods] = useState<Food[]>([]);
  const [rows, setRows] = useState<IngredientRow[]>([{ key: 1, foodId: "", quantity: "" }]);
  const [goalContext, setGoalContext] = useState<GoalContext | null>(null);
  const [compareToGoal, setCompareToGoal] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setError("");
    Promise.all([getFoods(), getDailySummary(), getDailyMacroSummary()])
      .then(([knownFoods, summary, macros]) => {
        setFoods(knownFoods);
        setGoalContext({
          target: { calories: summary.adjusted_goal, ...macros.target },
          consumed: { calories: summary.consumed, ...macros.consumed },
          hasMacroTarget: macros.plan_id !== null,
          source: summary.target_source,
          dayKind: summary.plan_day_kind,
        });
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the food database."))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) exit();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSaving]);

  const estimate = useMemo(() => {
    if (!rows.length || rows.some((row) => !row.foodId || !row.quantity || Number(row.quantity) <= 0)) return null;
    try {
      return calculateRecipeNutrition(foods, rows.map((row) => ({ foodId: Number(row.foodId), quantity: Number(row.quantity) })));
    } catch {
      return null;
    }
  }, [foods, rows]);

  const remainingBefore = useMemo(
    () => goalContext ? remainingNutrition(goalContext.target, goalContext.consumed) : null,
    [goalContext]
  );
  const remainingAfter = useMemo(
    () => goalContext && estimate ? remainingNutrition(goalContext.target, goalContext.consumed, estimate) : null,
    [goalContext, estimate]
  );

  if (!isOpen) return null;

  function updateRow(key: number, patch: Partial<IngredientRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
    setError("");
  }

  function selectFood(row: IngredientRow, foodId: string) {
    const food = foods.find((item) => item.id === Number(foodId));
    updateRow(row.key, {
      foodId,
      quantity: food ? String(food.reference_quantity) : "",
    });
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey.current++, foodId: "", quantity: "" }]);
    setError("");
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
    setError("");
  }

  function reset() {
    nextKey.current = 2;
    setRows([{ key: 1, foodId: "", quantity: "" }]);
    setError("");
  }

  function exit() {
    if (isSaving) return;
    reset();
    onClose();
  }

  async function commit() {
    setError("");
    try {
      const calculated = calculateRecipeNutrition(
        foods,
        rows.map((row) => ({ foodId: Number(row.foodId), quantity: Number(row.quantity) }))
      );
      setIsSaving(true);
      const meal = await logMeal(calculated.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })));
      reset();
      onClose();
      onCommitted(meal);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this recipe to today.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedIds = new Set(rows.map((row) => Number(row.foodId)).filter(Boolean));

  return (
    <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) exit(); }}>
      <section aria-labelledby="recipe-calculator-title" aria-modal="true" className="recipeCalculatorDialog" role="dialog">
        <div className="modalHeader">
          <div><p className="eyebrow">Local estimate</p><h2 id="recipe-calculator-title">Recipe calories and macros</h2></div>
          <button aria-label="Exit recipe calculator" className="iconButton" disabled={isSaving} onClick={exit} type="button"><X size={18} /></button>
        </div>
        <p className="muted">Choose foods from your database and enter the amount used in the whole recipe. Nothing is logged until you commit.</p>

        <label className="stackedField recipeGoalChoice">
          <span>Use this recipe for</span>
          <select aria-label="Recipe goal comparison" value={compareToGoal ? "routine" : "calculate"} onChange={(event) => setCompareToGoal(event.target.value === "routine")}>
            <option value="routine">Today&apos;s preplanned routine — fit what remains</option>
            <option value="calculate">Nutrition estimate only</option>
          </select>
        </label>

        {isLoading ? <p className="muted">Loading foods…</p> : foods.length ? (
          <div className="recipeIngredientRows">
            {rows.map((row, index) => {
              const food = foods.find((item) => item.id === Number(row.foodId));
              const itemEstimate = estimate?.ingredients.find((item) => item.foodId === food?.id);
              return (
                <div className="recipeIngredientRow" key={row.key}>
                  <label className="stackedField">
                    <span>Ingredient {index + 1}</span>
                    <select aria-label={`Recipe ingredient ${index + 1}`} value={row.foodId} onChange={(event) => selectFood(row, event.target.value)}>
                      <option value="">Select a food</option>
                      {foods.map((item) => <option disabled={selectedIds.has(item.id) && item.id !== food?.id} key={item.id} value={item.id}>{displayName(item.name)}</option>)}
                    </select>
                  </label>
                  <label className="stackedField">
                    <span>Quantity {food ? `(${food.unit})` : ""}</span>
                    <input aria-label={`Recipe quantity ${index + 1}`} disabled={!food} min="0.01" placeholder="Quantity" step="0.01" type="number" value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: event.target.value })} />
                  </label>
                  <div className="ingredientEstimate">{itemEstimate ? <><strong>{itemEstimate.calories} kcal</strong><small>P {itemEstimate.protein_g}g · C {itemEstimate.carbs_g}g · F {itemEstimate.fat_g}g</small></> : <small>Select a food and quantity</small>}</div>
                  <button aria-label={`Remove ingredient ${index + 1}`} className="iconButton danger" disabled={rows.length === 1 || isSaving} onClick={() => removeRow(row.key)} type="button"><Trash2 size={16} /></button>
                </div>
              );
            })}
            <button className="secondaryButton inlineFit" disabled={rows.length >= foods.length || isSaving} onClick={addRow} type="button"><Plus size={17} />Add ingredient</button>
          </div>
        ) : <p className="error">Your food database is empty. Add foods before calculating a recipe.</p>}

        <section aria-live="polite" className="recipeNutritionTotal">
          <div><span>Total calories</span><strong>{estimate?.calories ?? 0} kcal</strong></div>
          <div><span>Protein</span><strong>{estimate?.protein_g ?? 0} g</strong></div>
          <div><span>Carbs</span><strong>{estimate?.carbs_g ?? 0} g</strong></div>
          <div><span>Fat</span><strong>{estimate?.fat_g ?? 0} g</strong></div>
          <div><span>Fiber</span><strong>{estimate?.fiber_g ?? 0} g</strong></div>
        </section>
        {compareToGoal && goalContext && remainingBefore && (
          <section className="recipeGoalComparison">
            <div className="panelHeader">
              <div><h3>What is left today</h3><p className="muted">{goalContext.source === "plan" ? `${formatDayKind(goalContext.dayKind)} routine target` : "Manual calorie target"}, after food already logged.</p></div>
            </div>
            <div className="goalComparisonGrid">
              <GoalGap label="Calories" before={remainingBefore.calories} after={remainingAfter?.calories ?? null} unit="kcal" />
              {goalContext.hasMacroTarget ? <>
                <GoalGap label="Protein" before={remainingBefore.protein_g} after={remainingAfter?.protein_g ?? null} unit="g" />
                <GoalGap label="Carbs" before={remainingBefore.carbs_g} after={remainingAfter?.carbs_g ?? null} unit="g" />
                <GoalGap label="Fat" before={remainingBefore.fat_g} after={remainingAfter?.fat_g ?? null} unit="g" />
                <GoalGap label="Fiber" before={remainingBefore.fiber_g} after={remainingAfter?.fiber_g ?? null} unit="g" />
              </> : <p className="muted noMacroGoal">Create a macro plan to compare protein, carbs, fat, and fiber. Calories still use your current manual goal.</p>}
            </div>
            <p className="muted recipeEstimateNote">“After recipe” is a preview only. It changes today&apos;s totals when you commit.</p>
          </section>
        )}
        <p className="muted recipeEstimateNote">Estimates use the calorie and macro references currently saved in your local food database.</p>
        {error && <p className="error">{error}</p>}
        <div className="modalActions">
          <button className="secondaryButton" disabled={isSaving} onClick={exit} type="button"><X size={17} />Exit</button>
          <button disabled={isLoading || isSaving || !estimate} onClick={commit} type="button"><Save size={17} />{isSaving ? "Committing…" : "Commit to today"}</button>
        </div>
      </section>
    </div>
  );
}

export function RecipeNutritionButton({ onCommitted }: { onCommitted: (meal: MealSummary) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button onClick={() => setIsOpen(true)} type="button"><Calculator size={17} />Check recipe calories</button>
      <RecipeNutritionCalculator isOpen={isOpen} onClose={() => setIsOpen(false)} onCommitted={onCommitted} />
    </>
  );
}

function displayName(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function GoalGap({ label, before, after, unit }: { label: string; before: number; after: number | null; unit: string }) {
  return <div><span>{label}</span><strong>{formatGap(before, unit)}</strong><small>{after === null ? "Add ingredients to preview" : `After recipe: ${formatGap(after, unit)}`}</small></div>;
}

function formatGap(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "Goal met";
  return rounded > 0 ? `${rounded} ${unit} left` : `${Math.abs(rounded)} ${unit} over`;
}

function formatDayKind(dayKind: DailySummary["plan_day_kind"]): string {
  if (!dayKind) return "Active daily";
  return dayKind.replace("_", " + ").replace(/^\w/, (character) => character.toUpperCase());
}
