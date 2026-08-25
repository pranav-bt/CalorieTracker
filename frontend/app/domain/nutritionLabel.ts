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

export const SUPPORTED_NUTRITION_LABEL_LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese"] as const;

const NUTRIENT_LABELS = {
  protein_g: [/^protein\b/i, /^proteinas?\b/i, /^proteines?\b/i, /^eiweiss\b/i],
  carbs_g: [/^total\s+carbohydrate\b/i, /^carbohydrates?\b/i, /^carbs?\b/i, /^carbohidratos?\b/i, /^carboidratos?\b/i, /^glucides?\b/i, /^kohlenhydrate\b/i, /^hidratos?\s+de\s+carbono\b/i, /^carboidrati\b/i],
  fat_g: [/^total\s+fat\b/i, /^fat\b/i, /^grasas?(?:\s+totales?)?\b/i, /^matieres?\s+grasses?\b/i, /^lipides?\b/i, /^fett\b/i, /^gorduras?(?:\s+totais?)?\b/i, /^grassi\b/i],
  fiber_g: [/^dietary\s+fib(?:er|re)\b/i, /^fib(?:er|re)\b/i, /^fibra(?:\s+(?:alimentaria|dietetica|alimentar))?\b/i, /^fibres?(?:\s+alimentaires?)?\b/i, /^ballaststoffe\b/i, /^fibre(?:\s+alimentari)?\b/i],
} as const;

const CALORIE_LABELS = [/^calories?(?:\s|$)/i, /^calorias?(?:\s|$)/i, /^energy(?:\s|$)/i, /^energie(?:\s|$)/i, /^energia(?:\s|$)/i, /^brennwert(?:\s|$)/i, /^valor\s+energetico(?:\s|$)/i];
const SERVING_LABEL = /serving\s*size|per\s+serving|tamano\s+de\s+(?:la\s+)?porcion|por\s+porcion|taille\s+de\s+la\s+portion|par\s+portion|portionsgrosse|pro\s+portion|porcao|por\s+porcao|porzione|per\s+porzione/i;

export function parseNutritionLabel(rawText: string): ParsedNutritionLabel {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeText(line.replace(/[|]/g, " ").replace(/\s+/g, " ").trim()))
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
    const label = CALORIE_LABELS.find((candidate) => candidate.test(line));
    if (!label || /from\s+fat/i.test(line)) continue;
    const sameLineText = line.replace(label, "");
    const sameLineKcal = kcalValue(sameLineText);
    if (sameLineKcal !== null) return sensibleCalories(sameLineKcal);
    const sameLine = numbers(sameLineText);
    if (sameLine.length) return sensibleCalories(sameLine[0]);
    const nextLineText = lines[index + 1] ?? "";
    const nextLineKcal = kcalValue(nextLineText);
    if (nextLineKcal !== null) return sensibleCalories(nextLineKcal);
    const nextLine = numbers(nextLineText);
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
  const servingIndex = lines.findIndex((line) => SERVING_LABEL.test(line));
  if (servingIndex < 0) return { quantity: 1, unit: "piece", found: false };
  const candidate = `${lines[servingIndex]} ${lines[servingIndex + 1] ?? ""}`;
  const supported = [...candidate.matchAll(/(\d+(?:[.,]\d+)?)\s*(g|gram(?:s|os|mes)?|gramm|ml|millilit(?:er|re|ro)(?:s)?)/gi)];
  if (supported.length) {
    const match = supported[supported.length - 1];
    return {
      quantity: parseNumeric(match[1]),
      unit: match[2].toLowerCase().startsWith("m") ? "ml" : "g",
      found: true,
    };
  }
  const household = candidate.match(new RegExp(`(?:${SERVING_LABEL.source})\\s*(\\d+(?:[.,]\\d+)?)\\s*(slice|piece|bar|container|packet|rebanada|pieza|tranche|scheibe|stuck|portion|porcao|fetta|pezzo)`, "i"));
  if (household) {
    return {
      quantity: parseNumeric(household[1]),
      unit: /slice|rebanada|tranche|scheibe|fetta/i.test(household[2]) ? "slice" : "piece",
      found: true,
    };
  }
  return { quantity: 1, unit: "piece", found: false };
}

function gramValues(text: string): number[] {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*g\b/gi)].map((match) => parseNumeric(match[1]));
}

function numbers(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => parseNumeric(match[0]));
}

function kcalValue(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*kcal\b/i);
  return match ? parseNumeric(match[1]) : null;
}

function parseNumeric(value: string): number {
  return Number(value.replace(",", "."));
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
}
