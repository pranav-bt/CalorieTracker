import type { Unit } from "../types";

export type ParsedNutritionLabel = {
  reference_quantity: number;
  unit: Unit;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: "low" | "medium" | "high";
  warnings: string[];
  raw_text: string;
};

const NUTRIENT_LABELS = {
  protein_g: [/^protein\b/i],
  carbs_g: [/^total\s+carbohydrate\b/i, /^carbohydrate\b/i, /^carbs?\b/i],
  fat_g: [/^total\s+fat\b/i, /^fat\b/i],
  fiber_g: [/^dietary\s+fib(?:er|re)\b/i, /^fib(?:er|re)\b/i],
} as const;

export function parseNutritionLabel(rawText: string): ParsedNutritionLabel {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/[|]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!lines.length) throw new Error("No text was found. Retake the photo with the label filling the frame.");

  const calories = findCalories(lines);
  if (calories === null) {
    throw new Error("Calories could not be identified. Retake the photo or enter the label manually.");
  }

  const serving = findServing(lines);
  const protein = findNutrient(lines, NUTRIENT_LABELS.protein_g);
  const carbs = findNutrient(lines, NUTRIENT_LABELS.carbs_g);
  const fat = findNutrient(lines, NUTRIENT_LABELS.fat_g);
  const fiber = findNutrient(lines, NUTRIENT_LABELS.fiber_g);
  const warnings: string[] = [];
  if (!serving.found) warnings.push("Serving quantity was not clear; confirm the default quantity and unit.");
  if (protein === null) warnings.push("Protein was not recognized and was set to 0 g.");
  if (carbs === null) warnings.push("Carbohydrates were not recognized and were set to 0 g.");
  if (fat === null) warnings.push("Fat was not recognized and was set to 0 g.");
  if (fiber === null) warnings.push("Fiber was not recognized and was set to 0 g.");
  const recognizedCoreMacros = [protein, carbs, fat].filter((value) => value !== null).length;

  return {
    reference_quantity: serving.quantity,
    unit: serving.unit,
    calories,
    protein_g: protein ?? 0,
    carbs_g: carbs ?? 0,
    fat_g: fat ?? 0,
    fiber_g: fiber ?? 0,
    confidence: serving.found && recognizedCoreMacros === 3 ? "high" : recognizedCoreMacros >= 2 ? "medium" : "low",
    warnings,
    raw_text: rawText,
  };
}

function findCalories(lines: string[]): number | null {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!/^calories(?:\s|$)/i.test(line) || /from\s+fat/i.test(line)) continue;
    const sameLine = numbers(line.replace(/^calories/i, ""));
    if (sameLine.length) return sensibleCalories(sameLine[0]);
    const nextLine = numbers(lines[index + 1] ?? "");
    if (nextLine.length) return sensibleCalories(nextLine[0]);
  }
  return null;
}

function sensibleCalories(value: number): number | null {
  return value >= 0 && value <= 5000 ? Math.round(value) : null;
}

function findNutrient(lines: string[], labels: readonly RegExp[]): number | null {
  for (let index = 0; index < lines.length; index++) {
    if (!labels.some((label) => label.test(lines[index]))) continue;
    const grams = gramValues(lines[index]);
    if (grams.length) return grams[0];
    const nextLineGrams = gramValues(lines[index + 1] ?? "");
    if (nextLineGrams.length) return nextLineGrams[0];
  }
  return null;
}

function findServing(lines: string[]): { quantity: number; unit: Unit; found: boolean } {
  const servingIndex = lines.findIndex((line) => /serving\s*size|per\s+serving/i.test(line));
  if (servingIndex < 0) return { quantity: 1, unit: "piece", found: false };
  const candidate = `${lines[servingIndex]} ${lines[servingIndex + 1] ?? ""}`;
  const supported = [...candidate.matchAll(/(\d+(?:\.\d+)?)\s*(g|gram(?:s)?|ml|milliliter(?:s)?)/gi)];
  if (supported.length) {
    const match = supported[supported.length - 1];
    return {
      quantity: Number(match[1]),
      unit: match[2].toLowerCase().startsWith("m") ? "ml" : "g",
      found: true,
    };
  }
  const household = candidate.match(/serving\s*size\s*(\d+(?:\.\d+)?)\s*(slice|piece|bar|container|packet)/i);
  if (household) {
    return {
      quantity: Number(household[1]),
      unit: household[2].toLowerCase() === "slice" ? "slice" : "piece",
      found: true,
    };
  }
  return { quantity: 1, unit: "piece", found: false };
}

function gramValues(text: string): number[] {
  return [...text.matchAll(/(\d+(?:\.\d+)?)\s*g\b/gi)].map((match) => Number(match[1]));
}

function numbers(text: string): number[] {
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}
