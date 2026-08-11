import type { GoalKind, RecalibrationConfidence } from "../types";

export type WeightEvidence = { date: string; weight_kg: number };
export type CalorieEvidence = { date: string; calories: number };

export type NutritionTrendDecision = {
  ready: boolean;
  confidence: RecalibrationConfidence;
  recommended_calories: number | null;
  estimated_maintenance_calories: number | null;
  actual_weight_change_kg_per_week: number | null;
  desired_weight_change_kg_per_week: number | null;
  evidence: string[];
  reason: string;
};

export function calculateNutritionTrendAdjustment(input: {
  as_of_date: string;
  current_calories: number;
  goal: GoalKind;
  target_weight_kg: number | null;
  target_date: string | null;
  weights: WeightEvidence[];
  calorie_days: CalorieEvidence[];
}): NutritionTrendDecision {
  const weights = dedupeWeights(input.weights).sort((a, b) => a.date.localeCompare(b.date));
  const calories = input.calorie_days.filter((day) => day.calories > 0);
  const span = weights.length >= 2 ? dayDifference(weights[0].date, weights[weights.length - 1].date) : 0;
  const coverage = span >= 0 ? calories.filter((day) => day.date >= weights[0]?.date && day.date <= weights[weights.length - 1]?.date).length / Math.max(1, span + 1) : 0;
  const gaps: string[] = [];
  if (weights.length < 4) gaps.push(`${4 - weights.length} more weight check-in${4 - weights.length === 1 ? "" : "s"}`);
  if (span < 10) gaps.push(`${10 - span} more day${10 - span === 9 ? "" : "s"} of trend history`);
  if (calories.length < 7) gaps.push(`${7 - calories.length} more fully logged food day${7 - calories.length === 1 ? "" : "s"}`);
  if (coverage < 0.7) gaps.push("meal logging on at least 70% of trend days");
  if (gaps.length) {
    return {
      ready: false, confidence: "low", recommended_calories: null,
      estimated_maintenance_calories: null, actual_weight_change_kg_per_week: null,
      desired_weight_change_kg_per_week: null,
      evidence: [`${weights.length} weight check-ins across ${span} days`, `${calories.length} logged food days`, `${Math.round(coverage * 100)}% logging coverage`],
      reason: `Trend adjustment was not applied. Needed: ${gaps.join(", ")}.`,
    };
  }

  const slopePerDay = linearWeightSlope(weights);
  const actualWeekly = round(slopePerDay * 7, 3);
  const latestWeight = weights[weights.length - 1].weight_kg;
  const desiredWeekly = round(desiredRate(input.goal, latestWeight, input.target_weight_kg, input.target_date, input.as_of_date), 3);
  const relevantCalories = calories.filter((day) => day.date >= weights[0].date && day.date <= weights[weights.length - 1].date);
  const averageIntake = relevantCalories.reduce((sum, day) => sum + day.calories, 0) / relevantCalories.length;
  const estimatedMaintenance = Math.round(averageIntake - (actualWeekly * 7700) / 7);
  const rawRecommendation = estimatedMaintenance + (desiredWeekly * 7700) / 7;
  const rateCloseEnough = Math.abs(actualWeekly - desiredWeekly) <= latestWeight * 0.001;
  const bounded = rateCloseEnough
    ? input.current_calories
    : clamp(rawRecommendation, input.current_calories - 150, input.current_calories + 150);
  const recommended = roundTo(Math.max(1200, bounded), 25);
  const confidence: RecalibrationConfidence = span >= 14 && weights.length >= 7 && coverage >= 0.85 ? "high" : "medium";

  return {
    ready: true,
    confidence,
    recommended_calories: recommended,
    estimated_maintenance_calories: estimatedMaintenance,
    actual_weight_change_kg_per_week: actualWeekly,
    desired_weight_change_kg_per_week: desiredWeekly,
    evidence: [
      `${weights.length} weight check-ins across ${span} days`,
      `${relevantCalories.length} logged food days (${Math.round(coverage * 100)}% coverage)`,
      `Observed weight trend ${signed(actualWeekly)} kg/week versus desired ${signed(desiredWeekly)} kg/week`,
      `Estimated maintenance from logged intake and weight trend: ${estimatedMaintenance} kcal/day`,
    ],
    reason: rateCloseEnough
      ? "The observed trend is close to the goal, so calories were held steady."
      : `The observed trend differed from the goal. The change was limited to 150 kcal for a conservative recalibration.`,
  };
}

function desiredRate(goal: GoalKind, weight: number, target: number | null, targetDate: string | null, asOf: string): number {
  if (goal === "maintain" || goal === "performance") return 0;
  if (goal === "recomposition") return -weight * 0.001;
  if (target !== null && targetDate) {
    const weeks = dayDifference(asOf, targetDate) / 7;
    if (weeks > 0) {
      const requested = (target - weight) / weeks;
      if (goal === "fat_loss" && requested < 0) return clamp(requested, -weight * 0.0075, -weight * 0.0025);
      if (goal === "muscle_gain" && requested > 0) return clamp(requested, weight * 0.001, weight * 0.005);
    }
  }
  return goal === "fat_loss" ? -weight * 0.005 : weight * 0.0025;
}

function linearWeightSlope(weights: WeightEvidence[]): number {
  const start = new Date(`${weights[0].date}T00:00:00`).getTime();
  const points = weights.map((item) => ({ x: (new Date(`${item.date}T00:00:00`).getTime() - start) / 86_400_000, y: item.weight_kg }));
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const numerator = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

function dedupeWeights(weights: WeightEvidence[]): WeightEvidence[] {
  const byDate = new Map<string, WeightEvidence>();
  for (const item of weights) byDate.set(item.date, item);
  return [...byDate.values()];
}
function dayDifference(from: string, to: string): number { return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000); }
function round(value: number, digits: number): number { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function roundTo(value: number, increment: number): number { return Math.round(value / increment) * increment; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function signed(value: number): string { return `${value > 0 ? "+" : ""}${value}`; }
