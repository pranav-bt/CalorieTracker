"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { ChefHat, Clipboard, PackageOpen, Share2, ShieldCheck, X } from "lucide-react";
import { RecipeNutritionButton } from "../components/RecipeNutritionCalculator";
import { getDailyMacroSummary, getDailySummary } from "../db";
import { getInventoryItems } from "../db/inventory";
import { getUserProfile } from "../db/plans";
import { remainingNutrition } from "../domain/recipeNutrition";
import {
  buildRecipePrompt,
  splitRecipeList,
  type RecipeMealType,
  type RecipeNutritionFocus,
  type RecipePreferences,
  type RecipePromptResult,
} from "../domain/recipePrompt";
import type { InventoryItem, MealSummary, NutritionTarget } from "../types";

const STORAGE_KEY = "fitness-companion.recipe-preferences.v1";

type FormState = {
  servings: string;
  mealType: RecipeMealType;
  maxTotalMinutes: string;
  cuisine: string;
  dietaryPreferences: string;
  avoidIngredients: string;
  mustUseIngredients: string;
  cookingEquipment: string;
  nutritionFocus: RecipeNutritionFocus;
  targetCaloriesPerServing: string;
  pantryOnly: boolean;
  allowBasicStaples: boolean;
  additionalNotes: string;
};

const INITIAL_FORM: FormState = {
  servings: "2",
  mealType: "routine_remaining",
  maxTotalMinutes: "30",
  cuisine: "",
  dietaryPreferences: "",
  avoidIngredients: "",
  mustUseIngredients: "",
  cookingEquipment: "",
  nutritionFocus: "balanced",
  targetCaloriesPerServing: "",
  pantryOnly: false,
  allowBasicStaples: true,
  additionalNotes: "",
};

export default function RecipesPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profileDietaryPreferences, setProfileDietaryPreferences] = useState<string[]>([]);
  const [remainingTarget, setRemainingTarget] = useState<NutritionTarget | null>(null);
  const [hasMacroTarget, setHasMacroTarget] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [preview, setPreview] = useState<RecipePromptResult | null>(null);
  const [message, setMessage] = useState("");
  const [mealMessage, setMealMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setForm({ ...INITIAL_FORM, ...JSON.parse(saved) });
    } catch {
      // A malformed preference cache should never block the recipe workflow.
    }
    setPreferencesReady(true);

    loadRecipeContext()
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load recipe context."))
      .finally(() => setIsLoading(false));
  }, []);

  async function loadRecipeContext() {
    const [items, profile, summary, macros] = await Promise.all([
      getInventoryItems(), getUserProfile(), getDailySummary(), getDailyMacroSummary(),
    ]);
    setInventory(items);
    setProfileDietaryPreferences(profile?.dietary_preferences ?? []);
    const remaining = remainingNutrition(
      { calories: summary.adjusted_goal, ...macros.target },
      { calories: summary.consumed, ...macros.consumed }
    );
    setRemainingTarget({
      calories: Math.max(0, remaining.calories),
      protein_g: Math.max(0, remaining.protein_g),
      carbs_g: Math.max(0, remaining.carbs_g),
      fat_g: Math.max(0, remaining.fat_g),
      fiber_g: Math.max(0, remaining.fiber_g),
    });
    setHasMacroTarget(macros.plan_id !== null);
  }

  useEffect(() => {
    if (!preferencesReady) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form, preferencesReady]);

  const usableCount = useMemo(
    () => inventory.filter((item) => item.quantity > 0 && (!item.expires_on || item.expires_on >= localDate())).length,
    [inventory]
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setMessage("");
    setError("");
  }

  function recipeCommitted(meal: MealSummary, inventoryNote?: string) {
    setMealMessage(`Added ${meal.total_calories} kcal · P ${meal.total_protein_g}g · C ${meal.total_carbs_g}g · F ${meal.total_fat_g}g to today.${inventoryNote ? ` ${inventoryNote}` : ""}`);
    loadRecipeContext().catch(() => setError("Recipe was logged, but the remaining target could not be refreshed."));
  }

  function createPrompt(): RecipePromptResult {
    const servings = Number(form.servings);
    const maxTotalMinutes = form.maxTotalMinutes ? Number(form.maxTotalMinutes) : null;
    const targetCalories = form.targetCaloriesPerServing ? Number(form.targetCaloriesPerServing) : null;
    if (!Number.isFinite(servings) || servings < 1 || servings > 20) {
      throw new Error("Servings must be between 1 and 20.");
    }
    if (maxTotalMinutes !== null && (!Number.isFinite(maxTotalMinutes) || maxTotalMinutes < 5 || maxTotalMinutes > 360)) {
      throw new Error("Total time must be between 5 and 360 minutes.");
    }
    if (targetCalories !== null && (!Number.isFinite(targetCalories) || targetCalories < 50 || targetCalories > 3000)) {
      throw new Error("Calories per serving must be between 50 and 3000.");
    }

    const preferences: RecipePreferences = {
      servings,
      mealType: form.mealType,
      maxTotalMinutes,
      cuisine: form.cuisine,
      dietaryPreferences: splitRecipeList(form.dietaryPreferences),
      avoidIngredients: splitRecipeList(form.avoidIngredients),
      mustUseIngredients: splitRecipeList(form.mustUseIngredients),
      cookingEquipment: splitRecipeList(form.cookingEquipment),
      nutritionFocus: form.nutritionFocus,
      targetCaloriesPerServing: targetCalories,
      pantryOnly: form.pantryOnly,
      allowBasicStaples: form.allowBasicStaples,
      additionalNotes: form.additionalNotes,
    };
    return buildRecipePrompt({ inventory, preferences, profileDietaryPreferences, remainingTarget, hasMacroTarget });
  }

  function showPreview(event: FormEvent) {
    event.preventDefault();
    setMessage(""); setError("");
    try {
      setPreview(createPrompt());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare the recipe prompt.");
    }
  }

  async function sharePrompt() {
    setMessage(""); setError(""); setIsSharing(true);
    try {
      const result = createPrompt();
      setPreview(result);
      await Share.share({
        title: "Pantry recipe request",
        text: result.prompt,
        dialogTitle: "Choose ChatGPT, Claude, or another app",
      });
      setMessage(`Recipe prompt prepared from ${result.includedItemCount} pantry items.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not share the recipe prompt.");
    } finally {
      setIsSharing(false);
    }
  }

  async function copyPrompt() {
    setMessage(""); setError("");
    try {
      const result = createPrompt();
      setPreview(result);
      await navigator.clipboard.writeText(result.prompt);
      setMessage("Recipe prompt copied. Paste it into ChatGPT, Claude, or another assistant.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not copy the recipe prompt.");
    }
  }

  return (
    <section className="pageStack">
      <div className="pageHeader">
        <div><p className="eyebrow">Optional AI handoff</p><h1>Recipes</h1></div>
        <div className="pageHeaderRight"><RecipeNutritionButton onCommitted={recipeCommitted} /><Link className="textButton secondaryButton" href="/inventory"><PackageOpen size={17} />Edit pantry</Link></div>
      </div>

      {mealMessage && <div className="recipeLoggedNotice"><strong>Recipe committed</strong><span>{mealMessage}</span><button aria-label="Dismiss recipe committed message" className="iconButton" onClick={() => setMealMessage("")} type="button"><X size={16} /></button></div>}

      <aside className="privacyNotice">
        <ShieldCheck size={20} />
        <div><strong>Nothing is sent automatically.</strong><p>Your prompt stays on this device until you choose Share or Copy. Fitness Companion does not receive your AI login or conversation.</p></div>
      </aside>

      <form className="panel recipeForm" onSubmit={showPreview}>
        <div className="panelHeader"><div><h2>What would you like?</h2><p className="muted">Preferences are remembered only in this app&apos;s local storage.</p></div><ChefHat size={20} /></div>
        <div className="recipeContext">
          <strong>{isLoading ? "Loading pantry…" : `${usableCount} usable pantry item${usableCount === 1 ? "" : "s"}`}</strong>
          <span>{remainingTarget ? `${remainingTarget.calories} kcal still available today${hasMacroTarget ? "; remaining macros included" : "; no macro plan yet"}.` : "No current target; the assistant will not invent one."}</span>
        </div>
        <div className="profileGrid">
          <Field label="Servings"><input min="1" max="20" required type="number" value={form.servings} onChange={(event) => update("servings", event.target.value)} /></Field>
          <Field label="Meal"><select value={form.mealType} onChange={(event) => update("mealType", event.target.value as RecipeMealType)}><option value="routine_remaining">Today&apos;s remaining routine target</option><option value="any">Any</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></Field>
          <Field label="Maximum total minutes"><input min="5" max="360" placeholder="No limit" type="number" value={form.maxTotalMinutes} onChange={(event) => update("maxTotalMinutes", event.target.value)} /></Field>
          <Field label="Nutrition emphasis"><select value={form.nutritionFocus} onChange={(event) => update("nutritionFocus", event.target.value as RecipeNutritionFocus)}><option value="balanced">Balanced</option><option value="high_protein">High protein</option><option value="high_fiber">High fiber</option><option value="lower_calorie">Lower calorie</option><option value="none">No preference</option></select></Field>
          <Field label="Cuisine"><input placeholder="e.g. Indian, Italian" value={form.cuisine} onChange={(event) => update("cuisine", event.target.value)} /></Field>
          <Field label="Calories per serving"><input min="50" max="3000" placeholder="Optional" type="number" value={form.targetCaloriesPerServing} onChange={(event) => update("targetCaloriesPerServing", event.target.value)} /></Field>
          <Field label="Diet preferences"><input placeholder="e.g. vegetarian, low sodium" value={form.dietaryPreferences} onChange={(event) => update("dietaryPreferences", event.target.value)} /></Field>
          <Field label="Avoid / allergies"><input placeholder="Treat these as strict" value={form.avoidIngredients} onChange={(event) => update("avoidIngredients", event.target.value)} /></Field>
          <Field label="Must use"><input placeholder="e.g. spinach, chicken" value={form.mustUseIngredients} onChange={(event) => update("mustUseIngredients", event.target.value)} /></Field>
          <Field label="Cooking equipment"><input placeholder="e.g. stovetop, air fryer" value={form.cookingEquipment} onChange={(event) => update("cookingEquipment", event.target.value)} /></Field>
        </div>
        {profileDietaryPreferences.length > 0 && <p className="muted">From your plan profile: {profileDietaryPreferences.join(", ")}</p>}
        <label className="stackedField"><span>Other instructions</span><textarea className="recipeTextarea" placeholder="Flavours, texture, cleanup, batch cooking…" value={form.additionalNotes} onChange={(event) => update("additionalNotes", event.target.value)} /></label>
        <div className="recipeChecks">
          <label><input checked={form.pantryOnly} type="checkbox" onChange={(event) => update("pantryOnly", event.target.checked)} />Only use pantry ingredients</label>
          <label><input checked={form.allowBasicStaples} type="checkbox" onChange={(event) => update("allowBasicStaples", event.target.checked)} />Assume water, salt, pepper, and cooking oil</label>
        </div>
        <div className="recipeActions">
          <button disabled={isLoading || isSharing} type="submit"><ChefHat size={17} />Preview prompt</button>
          <button className="secondaryButton" disabled={isLoading || isSharing} onClick={copyPrompt} type="button"><Clipboard size={17} />Copy</button>
          <button disabled={isLoading || isSharing} onClick={sharePrompt} type="button"><Share2 size={17} />{isSharing ? "Opening…" : Capacitor.isNativePlatform() ? "Share with AI" : "Share prompt"}</button>
        </div>
        {message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}
      </form>

      {!isLoading && usableCount === 0 && <section className="panel emptyRecipeState"><PackageOpen size={22} /><div><h2>Your pantry has no usable ingredients</h2><p className="muted">Add stock with a quantity above zero. Expired items are kept out of AI prompts.</p></div><Link className="textButton" href="/inventory">Add ingredients</Link></section>}

      {preview && <section className="panel promptPreview"><div className="panelHeader"><div><h2>Prompt preview</h2><p className="muted">Uses {preview.includedItemCount} pantry items{preview.excludedExpiredNames.length ? ` and excludes ${preview.excludedExpiredNames.length} expired item${preview.excludedExpiredNames.length === 1 ? "" : "s"}` : ""}.</p></div><Share2 size={18} /></div><pre>{preview.prompt}</pre></section>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="stackedField"><span>{label}</span>{children}</label>;
}

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
