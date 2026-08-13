import type { InventoryItem, NutritionTarget } from "../types";

export type RecipeMealType = "routine_remaining" | "breakfast" | "lunch" | "dinner" | "snack" | "any";
export type RecipeNutritionFocus = "balanced" | "high_protein" | "high_fiber" | "lower_calorie" | "none";

export type RecipePreferences = {
  servings: number;
  mealType: RecipeMealType;
  maxTotalMinutes: number | null;
  cuisine: string;
  dietaryPreferences: string[];
  avoidIngredients: string[];
  mustUseIngredients: string[];
  cookingEquipment: string[];
  nutritionFocus: RecipeNutritionFocus;
  targetCaloriesPerServing: number | null;
  pantryOnly: boolean;
  allowBasicStaples: boolean;
  additionalNotes: string;
};

export type RecipePromptInput = {
  inventory: InventoryItem[];
  preferences: RecipePreferences;
  profileDietaryPreferences?: string[];
  remainingTarget?: NutritionTarget | null;
  hasMacroTarget?: boolean;
  today?: string;
};

export type RecipePromptResult = {
  prompt: string;
  includedItemCount: number;
  excludedExpiredNames: string[];
};

const NUTRITION_LABELS: Record<RecipeNutritionFocus, string> = {
  balanced: "balanced calories and macros",
  high_protein: "high protein",
  high_fiber: "high fiber",
  lower_calorie: "lower calorie while still filling",
  none: "no special macro emphasis",
};

export function splitRecipeList(value: string): string[] {
  return uniqueStrings(value.split(/[,\n]/));
}

export function buildRecipePrompt(input: RecipePromptInput): RecipePromptResult {
  const today = input.today ?? localDate();
  const excludedExpiredNames = uniqueStrings(
    input.inventory
      .filter((item) => Boolean(item.expires_on && item.expires_on < today))
      .map((item) => item.name)
  );
  const available = input.inventory
    .filter((item) => item.quantity > 0 && (!item.expires_on || item.expires_on >= today))
    .sort((left, right) => {
      const leftExpiry = left.expires_on ?? "9999-12-31";
      const rightExpiry = right.expires_on ?? "9999-12-31";
      return leftExpiry.localeCompare(rightExpiry) || left.name.localeCompare(right.name);
    });

  if (!available.length) {
    throw new Error("Add at least one unexpired ingredient with a quantity above zero before requesting recipes.");
  }

  const preferences = input.preferences;
  const dietaryPreferences = uniqueStrings([
    ...(input.profileDietaryPreferences ?? []),
    ...preferences.dietaryPreferences,
  ]);
  const pantryLines = available.map((item) => {
    const expiry = item.expires_on
      ? `; expires ${item.expires_on}${isUseSoon(item.expires_on, today) ? "; prioritize using soon" : ""}`
      : "";
    return `- ${displayName(item.name)}: ${formatQuantity(item.quantity)} ${item.unit} (${item.location}${expiry})`;
  });

  const constraintLines = [
    `- Servings: ${clampWhole(preferences.servings, 1, 20)}`,
    `- Meal: ${preferences.mealType === "routine_remaining" ? "fit today's remaining routine target" : preferences.mealType}`,
    `- Nutrition emphasis: ${NUTRITION_LABELS[preferences.nutritionFocus]}`,
    preferences.maxTotalMinutes
      ? `- Maximum total time: ${clampWhole(preferences.maxTotalMinutes, 5, 360)} minutes`
      : "- Maximum total time: no limit supplied",
    `- Cuisine preference: ${preferences.cuisine.trim() || "open to suggestions"}`,
    `- Dietary preferences: ${dietaryPreferences.join(", ") || "none supplied"}`,
    `- Avoid or allergy list: ${uniqueStrings(preferences.avoidIngredients).join(", ") || "none supplied"}`,
    `- Ingredients I especially want used: ${uniqueStrings(preferences.mustUseIngredients).join(", ") || "none supplied"}`,
    `- Available cooking equipment: ${uniqueStrings(preferences.cookingEquipment).join(", ") || "standard home kitchen"}`,
    preferences.targetCaloriesPerServing
      ? `- Preferred calories per serving: about ${clampWhole(preferences.targetCaloriesPerServing, 50, 3000)} kcal`
      : "- Preferred calories per serving: not supplied",
    `- Pantry rule: ${pantryRule(preferences)}`,
    `- Additional notes: ${preferences.additionalNotes.trim() || "none"}`,
  ];

  const dailyTargetLines = input.remainingTarget
    ? [
        "Nutrition still remaining today after food already logged:",
        input.hasMacroTarget === false
          ? `- ${Math.round(input.remainingTarget.calories)} kcal; macro targets are unavailable because no active macro plan exists`
          : `- ${Math.round(input.remainingTarget.calories)} kcal; ${roundMacro(input.remainingTarget.protein_g)} g protein; ${roundMacro(input.remainingTarget.carbs_g)} g carbs; ${roundMacro(input.remainingTarget.fat_g)} g fat; ${roundMacro(input.remainingTarget.fiber_g)} g fiber`,
      ]
    : ["Remaining nutrition context: no current calorie target is available, so do not invent one."];

  const excludedLine = excludedExpiredNames.length
    ? `Expired entries were deliberately excluded and must not be used: ${excludedExpiredNames.map(displayName).join(", ")}.`
    : "No expired pantry entries were supplied.";

  const prompt = [
    "Act as a practical recipe assistant. Use the pantry snapshot and constraints below.",
    "",
    "Current usable pantry inventory:",
    ...pantryLines,
    "",
    excludedLine,
    "",
    "Preferences and constraints:",
    ...constraintLines,
    "",
    ...dailyTargetLines,
    "",
    "Please:",
    "1. Suggest three suitable recipe options in a compact comparison, then recommend one.",
    "2. For the recommended option, give exact ingredient quantities, clear steps, total time, and storage guidance.",
    "3. Estimate calories, protein, carbs, fat, and fiber per serving. Label these as estimates.",
    "4. Never claim an ingredient is in my pantry unless it appears above, and never exceed listed quantities.",
    "5. Treat the avoid/allergy list as a hard safety constraint. If it is ambiguous, ask me before proposing a recipe.",
    "6. Clearly label every ingredient that I would need to buy or substitute.",
  ].join("\n");

  return { prompt, includedItemCount: available.length, excludedExpiredNames };
}

function pantryRule(preferences: RecipePreferences): string {
  const staples = preferences.allowBasicStaples
    ? "Water, salt, pepper, and cooking oil may be assumed as basic staples."
    : "Do not assume even basic staples unless listed.";
  return preferences.pantryOnly
    ? `Use only listed pantry ingredients. ${staples}`
    : `Prefer listed pantry ingredients; small additions are allowed only when clearly marked as needed. ${staples}`;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  });
  return result;
}

function displayName(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampWhole(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function isUseSoon(expiresOn: string, today: string): boolean {
  const expires = new Date(`${expiresOn}T00:00:00`).getTime();
  const start = new Date(`${today}T00:00:00`).getTime();
  const days = Math.round((expires - start) / 86_400_000);
  return days >= 0 && days <= 3;
}

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
