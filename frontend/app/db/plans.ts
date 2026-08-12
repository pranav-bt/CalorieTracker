"use client";

import { Capacitor } from "@capacitor/core";
import { calculateNutritionPlan, retargetNutritionPlan } from "../domain/nutrition";
import {
  calculateNutritionTrendAdjustment,
  type NutritionTrendDecision,
} from "../domain/nutritionRecalibration";
import type {
  BodyMeasurement,
  MacroCalculationResult,
  NutritionPlan,
  NutritionPlanDay,
  PlanSource,
  RecalibrationChange,
  RecalibrationReport,
  UserProfile,
} from "../types";
import { getDb, inTransaction } from "./client";

export type StoredNutritionPlan = NutritionPlan & { days: NutritionPlanDay[] };

function requireAndroid(): void {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Plan storage is available in the Android app.");
  }
}

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseStringArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse((value as string) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseNumberArray(value: unknown): number[] {
  try {
    const parsed = JSON.parse((value as string) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === "number") : [];
  } catch {
    return [];
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query("SELECT * FROM user_profile WHERE id=1");
  const row = values?.[0];
  if (!row?.birth_date || !row?.height_cm || !row?.metabolic_sex) return null;
  return {
    birth_date: row.birth_date as string,
    metabolic_sex: row.metabolic_sex as UserProfile["metabolic_sex"],
    height_cm: row.height_cm as number,
    activity_level: row.activity_level as UserProfile["activity_level"],
    primary_goal: row.primary_goal as UserProfile["primary_goal"],
    physique_goal: row.physique_goal as UserProfile["physique_goal"],
    current_state: row.current_state as UserProfile["current_state"],
    target_weight_kg: row.target_weight_kg as number | null,
    target_date: row.target_date as string | null,
    event_name: row.event_name as string,
    event_date: row.event_date as string | null,
    workout_days_per_week: row.workout_days_per_week as number,
    preferred_workout_days: parseNumberArray(row.preferred_workout_days_json),
    workout_session_minutes: row.workout_session_minutes as number,
    flex_days_per_week: row.flex_days_per_week as number,
    flex_day_weekday: row.flex_day_weekday as number | null,
    dietary_preferences: parseStringArray(row.dietary_preferences_json),
    available_equipment: parseStringArray(row.available_equipment_json),
    injuries_or_limitations: parseStringArray(row.limitations_json),
  };
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  requireAndroid();
  const db = await getDb();
  await writeUserProfile(db, profile, true);
}

async function writeUserProfile(
  db: Awaited<ReturnType<typeof getDb>>,
  profile: UserProfile,
  transaction: boolean
): Promise<void> {
  await db.run(
    `UPDATE user_profile SET
       birth_date=?, metabolic_sex=?, height_cm=?, activity_level=?, primary_goal=?,
       physique_goal=?, current_state=?,
       target_weight_kg=?, target_date=?, event_name=?, event_date=?, workout_days_per_week=?,
       preferred_workout_days_json=?, workout_session_minutes=?, flex_days_per_week=?,
       flex_day_weekday=?, dietary_preferences_json=?, available_equipment_json=?,
       limitations_json=?, updated_at=datetime('now')
     WHERE id=1`,
    [
      profile.birth_date,
      profile.metabolic_sex,
      profile.height_cm,
      profile.activity_level,
      profile.primary_goal,
      profile.physique_goal,
      profile.current_state,
      profile.target_weight_kg,
      profile.target_date,
      profile.event_name,
      profile.event_date,
      profile.workout_days_per_week,
      JSON.stringify(profile.preferred_workout_days),
      profile.workout_session_minutes,
      profile.flex_days_per_week,
      profile.flex_day_weekday,
      JSON.stringify(profile.dietary_preferences),
      JSON.stringify(profile.available_equipment),
      JSON.stringify(profile.injuries_or_limitations),
    ],
    transaction
  );
}

export async function getCalculatorDraft<T extends Record<string, unknown>>(): Promise<Partial<T> | null> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query("SELECT calculator_draft_json FROM settings WHERE id=1");
  try {
    const parsed = JSON.parse((values?.[0]?.calculator_draft_json as string) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Partial<T> : null;
  } catch {
    return null;
  }
}

export async function saveCalculatorDraft(draft: Record<string, unknown>): Promise<void> {
  requireAndroid();
  const db = await getDb();
  await db.run("UPDATE settings SET calculator_draft_json=? WHERE id=1", [JSON.stringify(draft)]);
}

export async function getBodyMeasurements(limit = 30): Promise<BodyMeasurement[]> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query(
    `SELECT id, recorded_at, weight_kg, body_fat_percent, waist_cm, chest_cm,
            hips_cm, arm_cm, thigh_cm, notes
     FROM body_measurements ORDER BY recorded_at DESC, id DESC LIMIT ?`,
    [limit]
  );
  return (values ?? []) as BodyMeasurement[];
}

export async function addBodyMeasurement(
  measurement: Omit<BodyMeasurement, "id">
): Promise<number> {
  requireAndroid();
  const db = await getDb();
  const { changes } = await db.run(
    `INSERT INTO body_measurements (
       recorded_at, weight_kg, body_fat_percent, waist_cm, chest_cm,
       hips_cm, arm_cm, thigh_cm, notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      measurement.recorded_at,
      measurement.weight_kg,
      measurement.body_fat_percent,
      measurement.waist_cm,
      measurement.chest_cm,
      measurement.hips_cm,
      measurement.arm_cm,
      measurement.thigh_cm,
      measurement.notes,
    ]
  );
  return changes?.lastId as number;
}

export async function calculateAndSaveNutritionPlan(
  profile: UserProfile,
  weightKg: number,
  source: PlanSource
): Promise<StoredNutritionPlan> {
  requireAndroid();
  const db = await getDb();
  const calculationInput = {
    as_of_date: today(),
    birth_date: profile.birth_date,
    metabolic_sex: profile.metabolic_sex,
    height_cm: profile.height_cm,
    weight_kg: weightKg,
    activity_level: profile.activity_level,
    primary_goal: profile.primary_goal,
    target_weight_kg: profile.target_weight_kg,
    target_date: profile.target_date,
    workout_days_per_week: profile.workout_days_per_week,
    preferred_workout_days: profile.preferred_workout_days,
    flex_days_per_week: profile.flex_days_per_week,
    flex_day_weekday: profile.flex_day_weekday,
  } as const;
  let result = calculateNutritionPlan(calculationInput);

  const { values: previousRows } = await db.query(
    "SELECT * FROM nutrition_plans WHERE is_active=1 ORDER BY id DESC LIMIT 1"
  );
  const previous = previousRows?.[0];
  let trendDecision: NutritionTrendDecision | null = null;
  if (previous && source === "recalibration") {
    const [weightRows, calorieRows] = await Promise.all([
      db.query(
        `SELECT substr(recorded_at, 1, 10) AS date, weight_kg
         FROM body_measurements ORDER BY recorded_at DESC, id DESC LIMIT 30`
      ),
      db.query(
        `SELECT date, SUM(total_calories) AS calories
         FROM meals WHERE date>=date(?, '-30 days') AND date<=?
         GROUP BY date ORDER BY date`,
        [today(), today()]
      ),
    ]);
    const historicalWeights = (weightRows.values ?? []).map((row) => ({
      date: row.date as string,
      weight_kg: row.weight_kg as number,
    })).filter((item) => item.date !== today());
    historicalWeights.push({ date: today(), weight_kg: weightKg });
    trendDecision = calculateNutritionTrendAdjustment({
      as_of_date: today(),
      current_calories: previous.daily_calories as number,
      goal: profile.primary_goal,
      target_weight_kg: profile.target_weight_kg,
      target_date: profile.target_date,
      weights: historicalWeights,
      calorie_days: (calorieRows.values ?? []).map((row) => ({
        date: row.date as string,
        calories: row.calories as number,
      })),
    });
    if (trendDecision.ready && trendDecision.recommended_calories !== null) {
      result = retargetNutritionPlan(
        calculationInput,
        result,
        trendDecision.recommended_calories,
        trendDecision.reason
      );
    }
  }

  return inTransaction(db, async () => {
    await writeUserProfile(db, profile, false);
    await db.run("UPDATE nutrition_plans SET is_active=0 WHERE is_active=1", [], false);
    const { changes } = await db.run(
      `INSERT INTO nutrition_plans (
         activated_at, is_active, source, calculation_method, profile_snapshot_json,
         daily_calories, weekly_calories, protein_g, carbs_g, fat_g, fiber_g, explanation
       ) VALUES (datetime('now'), 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        source,
        result.calculation_method,
        JSON.stringify({ ...profile, weight_kg: weightKg, assumptions: result.assumptions }),
        result.calories,
        result.weekly_calories,
        result.protein_g,
        result.carbs_g,
        result.fat_g,
        result.fiber_g,
        result.explanation,
      ],
      false
    );
    const planId = changes?.lastId as number;
    for (const day of result.days) {
      await db.run(
        `INSERT INTO nutrition_plan_days (
           plan_id, weekday, day_kind, calories, protein_g, carbs_g, fat_g, fiber_g
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          planId, day.weekday, day.day_kind, day.calories,
          day.protein_g, day.carbs_g, day.fat_g, day.fiber_g,
        ],
        false
      );
    }

    if (previous && source === "recalibration") {
      await saveRecalibrationReport(db, previous, planId, result, trendDecision, false);
    }
    return resultToStoredPlan(planId, source, result);
  });
}

async function saveRecalibrationReport(
  db: Awaited<ReturnType<typeof getDb>>,
  previous: Record<string, unknown>,
  newPlanId: number,
  result: MacroCalculationResult,
  trendDecision: NutritionTrendDecision | null,
  transaction = true
): Promise<void> {
  const comparisons: Array<[string, number, number]> = [
    ["Daily calories", previous.daily_calories as number, result.calories],
    ["Protein", previous.protein_g as number, result.protein_g],
    ["Carbohydrates", previous.carbs_g as number, result.carbs_g],
    ["Fat", previous.fat_g as number, result.fat_g],
  ];
  const changes: RecalibrationChange[] = comparisons
    .filter(([, oldValue, newValue]) => oldValue !== newValue)
    .map(([field, oldValue, newValue]) => ({
      area: "nutrition",
      field,
      previous_value: oldValue,
      new_value: newValue,
      reason: trendDecision?.ready
        ? trendDecision.reason
        : "Profile, goal, timeline, or activity inputs changed; the baseline formula was recalculated.",
    }));
  const evidence = trendDecision ? [...trendDecision.evidence, trendDecision.reason] : [
    "Current profile and most recent entered body weight",
    "Selected activity level, goal, target date, workout days, and flex-day preference",
    "Insufficient trend history for an adherence-based metabolic adjustment",
  ];
  const summary = changes.length
    ? `${changes.length} nutrition target${changes.length === 1 ? " was" : "s were"} updated.`
    : "Inputs were recalculated and the targets did not need to change.";
  await db.run(
    `INSERT INTO recalibration_reports (
       previous_plan_id, new_plan_id, confidence, summary, evidence_json, changes_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [previous.id, newPlanId, trendDecision?.confidence ?? "low", summary, JSON.stringify(evidence), JSON.stringify(changes)],
    transaction
  );
}

export async function getNutritionPlans(limit = 3): Promise<StoredNutritionPlan[]> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query(
    "SELECT * FROM nutrition_plans WHERE archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT ?",
    [limit]
  );
  const plans: StoredNutritionPlan[] = [];
  for (const row of values ?? []) {
    const { values: dayRows } = await db.query(
      `SELECT weekday, day_kind, calories, protein_g, carbs_g, fat_g, fiber_g
       FROM nutrition_plan_days WHERE plan_id=? ORDER BY weekday`,
      [row.id]
    );
    plans.push(rowToPlan(row, (dayRows ?? []) as NutritionPlanDay[]));
  }
  return plans;
}

export async function getActiveNutritionPlan(): Promise<StoredNutritionPlan | null> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query(
    "SELECT * FROM nutrition_plans WHERE is_active=1 AND archived_at IS NULL ORDER BY activated_at DESC, id DESC LIMIT 1"
  );
  const row = values?.[0];
  if (!row) return null;
  const { values: dayRows } = await db.query(
    `SELECT weekday, day_kind, calories, protein_g, carbs_g, fat_g, fiber_g
     FROM nutrition_plan_days WHERE plan_id=? ORDER BY weekday`,
    [row.id]
  );
  return rowToPlan(row, (dayRows ?? []) as NutritionPlanDay[]);
}

export async function restoreNutritionPlan(planId: number): Promise<void> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query("SELECT * FROM nutrition_plans WHERE id=?", [planId]);
  const plan = values?.[0];
  if (!plan) throw new Error("Plan not found.");
  await inTransaction(db, async () => {
    await db.run("UPDATE nutrition_plans SET is_active=0 WHERE is_active=1", [], false);
    await db.run(
      "UPDATE nutrition_plans SET archived_at=NULL, is_active=1, activated_at=datetime('now') WHERE id=?",
      [planId],
      false
    );
  });
}

export async function discardNutritionPlan(planId: number): Promise<void> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query("SELECT is_active FROM nutrition_plans WHERE id=? AND archived_at IS NULL", [planId]);
  const wasActive = Boolean(values?.[0]?.is_active);
  if (!values?.[0]) throw new Error("Plan not found.");
  await inTransaction(db, async () => {
    await db.run(
      "UPDATE nutrition_plans SET is_active=0, archived_at=datetime('now') WHERE id=?",
      [planId],
      false
    );
    if (wasActive) {
      const { values: previousRows } = await db.query(
        "SELECT id FROM nutrition_plans WHERE archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1"
      );
      if (previousRows?.[0]) {
        await db.run(
          "UPDATE nutrition_plans SET is_active=1, activated_at=datetime('now') WHERE id=?",
          [previousRows[0].id],
          false
        );
      }
    }
  });
}

export async function unarchiveNutritionPlan(planId: number): Promise<void> {
  requireAndroid();
  const db = await getDb();
  await db.run("UPDATE nutrition_plans SET archived_at=NULL WHERE id=?", [planId]);
}

export async function getLatestRecalibrationReport(): Promise<RecalibrationReport | null> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query(
    "SELECT * FROM recalibration_reports ORDER BY created_at DESC, id DESC LIMIT 1"
  );
  const row = values?.[0];
  if (!row) return null;
  return {
    id: row.id as number,
    created_at: row.created_at as string,
    confidence: row.confidence as RecalibrationReport["confidence"],
    summary: row.summary as string,
    evidence: parseStringArray(row.evidence_json),
    changes: JSON.parse((row.changes_json as string) || "[]") as RecalibrationChange[],
  };
}

function resultToStoredPlan(
  id: number,
  source: PlanSource,
  result: MacroCalculationResult
): StoredNutritionPlan {
  return {
    id,
    created_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
    is_active: true,
    source,
    calculation_method: result.calculation_method,
    calories: result.calories,
    weekly_calories: result.weekly_calories,
    protein_g: result.protein_g,
    carbs_g: result.carbs_g,
    fat_g: result.fat_g,
    fiber_g: result.fiber_g,
    explanation: result.explanation,
    days: result.days,
  };
}

function rowToPlan(row: Record<string, unknown>, days: NutritionPlanDay[]): StoredNutritionPlan {
  return {
    id: row.id as number,
    created_at: row.created_at as string,
    activated_at: row.activated_at as string | null,
    is_active: Boolean(row.is_active),
    source: row.source as PlanSource,
    calculation_method: row.calculation_method as string,
    calories: row.daily_calories as number,
    weekly_calories: row.weekly_calories as number,
    protein_g: row.protein_g as number,
    carbs_g: row.carbs_g as number,
    fat_g: row.fat_g as number,
    fiber_g: row.fiber_g as number,
    explanation: row.explanation as string,
    days,
  };
}
