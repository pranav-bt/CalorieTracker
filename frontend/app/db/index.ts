"use client";

import { Capacitor } from "@capacitor/core";
import { getDb, inTransaction } from "./client";
import type {
  DailySummary,
  DailyMacroSummary,
  Food,
  HeartPointsBalance,
  HistoryDay,
  MealItem,
  MealRecord,
  MealSummary,
  Redemption,
  RewardItem,
  Settings,
  Unit,
} from "../types";
import { calculateTodayTarget } from "../domain/dailyTarget";
import {
  awardConfiguredPoints,
  configuredPointValue,
  getConfiguredLoveNote,
  loadRewardRuntime,
  rewardMessagePool,
} from "./rewards";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function native(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

function getISOWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function normalizeUnit(unit: string): Unit {
  return (unit === "gm" ? "g" : unit) as Unit;
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function rowToFood(row: Record<string, unknown>): Food {
  return {
    id: row.id as number,
    name: row.name as string,
    unit: row.unit as Unit,
    reference_quantity: row.reference_quantity as number,
    reference_calories: row.reference_calories as number,
    protein_g: row.protein_g as number,
    carbs_g: row.carbs_g as number,
    fat_g: row.fat_g as number,
    fiber_g: row.fiber_g as number,
    source: row.source as "manual" | "label_scan",
  };
}

function pick<T>(pool: T[], idx: number): T {
  return pool[((idx % pool.length) + pool.length) % pool.length];
}

function pickOptional(pool: string[], idx: number): string {
  return pool.length ? pick(pool, idx) : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily summary (native)
// ─────────────────────────────────────────────────────────────────────────────

async function nativeDailySummary(today: string = getToday()): Promise<DailySummary> {
  const db = await getDb();
  const rewardRuntime = await loadRewardRuntime(db);
  const rewardPreferences = rewardRuntime.preferences;
  const { values: sv } = await db.query("SELECT * FROM settings WHERE id = 1");
  const s = sv![0] as Record<string, unknown>;

  const weekStartDay = s.week_start_day as number;
  const manualDailyGoal = s.daily_calorie_goal as number;
  const manualWeeklyGoal = s.weekly_calorie_goal as number;
  const goalMode = s.goal_mode as string;
  const distributionMode = (s.calorie_distribution_mode as string) ?? "fixed";

  const cur = new Date(today + "T00:00:00");
  const pyWeekday = (cur.getDay() + 6) % 7; // JS→Python weekday
  const daysSince = ((pyWeekday - weekStartDay) % 7 + 7) % 7;

  const wStart = new Date(cur);
  wStart.setDate(cur.getDate() - daysSince);
  const wEnd = new Date(wStart);
  wEnd.setDate(wStart.getDate() + 6);
  const weekStart = wStart.toISOString().slice(0, 10);
  const weekEnd = wEnd.toISOString().slice(0, 10);

  const q = (sql: string, p: unknown[] = []) => db.query(sql, p);

  const { values: planRows } = await q(
    `SELECT p.id, p.activated_at, p.daily_calories, p.weekly_calories,
            d.weekday, d.day_kind, d.calories
     FROM nutrition_plans p
     JOIN nutrition_plan_days d ON d.plan_id=p.id
     WHERE p.is_active=1 AND p.archived_at IS NULL
     ORDER BY d.weekday`
  );
  const activePlanRows = planRows ?? [];
  const targetSource = activePlanRows.length ? "plan" as const : "manual" as const;
  const planTargets = new Map(activePlanRows.map((row) => [row.weekday as number, row.calories as number]));
  const todayPlanRow = activePlanRows.find((row) => row.weekday === pyWeekday);
  const dailyGoal = activePlanRows.length
    ? activePlanRows[0].daily_calories as number
    : manualDailyGoal;
  const weeklyGoal = activePlanRows.length
    ? activePlanRows[0].weekly_calories as number
    : manualWeeklyGoal;
  const plannedGoal = todayPlanRow?.calories as number | undefined ?? manualDailyGoal;
  const activatedDate = activePlanRows[0]?.activated_at
    ? String(activePlanRows[0].activated_at).slice(0, 10)
    : weekStart;
  const carryoverStart = activatedDate > weekStart ? activatedDate : weekStart;

  const [todayR, priorDaysR, weekR, daysLoggedR, allDatesR, earnedR, spentR] =
    await Promise.all([
      q("SELECT COALESCE(SUM(total_calories),0) as v FROM meals WHERE date=?", [today]),
      q("SELECT date, SUM(total_calories) AS calories FROM meals WHERE date>=? AND date<? GROUP BY date", [carryoverStart, today]),
      q("SELECT COALESCE(SUM(total_calories),0) as v FROM meals WHERE date>=? AND date<=?", [weekStart, weekEnd]),
      q("SELECT COUNT(DISTINCT date) as v FROM meals WHERE date>=? AND date<=?", [weekStart, weekEnd]),
      q("SELECT DISTINCT date FROM meals"),
      q("SELECT COALESCE(SUM(points),0) as v FROM heart_points_log"),
      q("SELECT COALESCE(SUM(points_spent),0) as v FROM redemptions"),
    ]);

  const todayConsumed = todayR.values![0].v as number;
  const priorDays = priorDaysR.values ?? [];
  const consumedBefore = priorDays.reduce((sum, row) => sum + Number(row.calories), 0);
  const plannedBefore = priorDays.reduce((sum, row) => {
    if (targetSource === "manual") return sum + manualDailyGoal;
    const date = new Date(`${row.date as string}T00:00:00`);
    const weekday = (date.getDay() + 6) % 7;
    return sum + (planTargets.get(weekday) ?? dailyGoal);
  }, 0);
  const weekConsumed = weekR.values![0].v as number;
  const daysLoggedThisWeek = daysLoggedR.values![0].v as number;
  const loggedDates = new Set((allDatesR.values ?? []).map((r) => r.date as string));
  const heartPoints = rewardPreferences.enabled && rewardPreferences.points_enabled
    ? (earnedR.values![0].v as number) - (spentR.values![0].v as number)
    : 0;

  // Streak
  let streak = 0;
  const check = new Date(cur);
  if (!loggedDates.has(today)) check.setDate(check.getDate() - 1);
  while (loggedDates.has(check.toISOString().slice(0, 10))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  const dayIdx = getDayOfYear(cur);
  const motivationsEnabled = rewardPreferences.enabled && rewardPreferences.motivations_enabled;
  const affirmation = motivationsEnabled ? pickOptional(rewardMessagePool(rewardRuntime, "affirmation"), dayIdx) : "";
  const greetingBase = motivationsEnabled ? pickOptional(rewardMessagePool(rewardRuntime, "day_greeting", String(pyWeekday)), dayIdx) : "";
  const partnerName = (s.partner_name as string) ?? "";
  const greeting = greetingBase ? (partnerName ? `Hey ${partnerName}! ${greetingBase}` : greetingBase) : "";

  const daysLeft = Math.floor((wEnd.getTime() - cur.getTime()) / 86_400_000) + 1;
  const { adjusted_goal: adjustedGoal, carryover_adjustment: carryoverAdjustment } = calculateTodayTarget({
    planned_today: plannedGoal,
    consumed_before: consumedBefore,
    planned_before: plannedBefore,
    days_left_including_today: daysLeft,
    mode: distributionMode as Settings["calorie_distribution_mode"],
  });

  let endOfDayNote: string | null = null;
  if (todayConsumed > 0) {
    const category = todayConsumed <= adjustedGoal ? "end_of_day_good" : "end_of_day_tough";
    endOfDayNote = motivationsEnabled ? pickOptional(rewardMessagePool(rewardRuntime, category), dayIdx) || null : null;
  }

  let weeklyReportMessage: string | null = null;
  if (daysLoggedThisWeek > 0) {
    const category = weekConsumed <= weeklyGoal ? "weekly_report_great" : weekConsumed <= weeklyGoal * 1.15 ? "weekly_report_ok" : "weekly_report_tough";
    weeklyReportMessage = motivationsEnabled ? pickOptional(rewardMessagePool(rewardRuntime, category), dayIdx) || null : null;
  }

  const isoWeek = getISOWeek(cur);
  const challengesEnabled = rewardPreferences.enabled && rewardPreferences.weekly_challenges_enabled;
  const currentChallenge = challengesEnabled ? pickOptional(rewardMessagePool(rewardRuntime, "weekly_challenge"), isoWeek - 1) : "";
  const challengeCompleted = (s.challenge_completed_week as string) === weekStart;
  const challengeCompletedMessage = challengesEnabled ? pickOptional(rewardMessagePool(rewardRuntime, "challenge_completed"), isoWeek - 1) : "";

  return {
    date: today,
    goal: adjustedGoal,
    goal_mode: goalMode as "daily" | "weekly",
    calorie_distribution_mode: distributionMode as "fixed" | "flexible_weekly",
    daily_goal: dailyGoal,
    weekly_goal: weeklyGoal,
    adjusted_goal: adjustedGoal,
    planned_goal: plannedGoal,
    carryover_adjustment: carryoverAdjustment,
    target_source: targetSource,
    plan_day_kind: targetSource === "plan"
      ? todayPlanRow?.day_kind as DailySummary["plan_day_kind"] ?? "standard"
      : null,
    consumed: todayConsumed,
    remaining: adjustedGoal - todayConsumed,
    week_consumed: weekConsumed,
    week_remaining: weeklyGoal - weekConsumed,
    week_start: weekStart,
    week_end: weekEnd,
    week_start_day: weekStartDay,
    greeting,
    affirmation,
    streak,
    partner_name: partnerName,
    end_of_day_note: endOfDayNote,
    days_logged_this_week: daysLoggedThisWeek,
    weekly_report_message: weeklyReportMessage,
    current_challenge: currentChallenge,
    challenge_completed: challengeCompleted,
    challenge_completed_message: challengeCompletedMessage,
    heart_points: heartPoints,
    rewards_enabled: rewardPreferences.enabled,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone detection
// ─────────────────────────────────────────────────────────────────────────────

function detectMilestoneKey(summary: DailySummary, mealCalories: number): string | null {
  const prev = summary.consumed - mealCalories;
  if (summary.streak === 30) return "streak_30";
  if (summary.streak === 7) return "streak_7";
  if (summary.consumed >= summary.adjusted_goal && prev < summary.adjusted_goal && summary.adjusted_goal > 0) return "goal_hit";
  if (summary.consumed === mealCalories) return "first_meal_today";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Daily summary
// ─────────────────────────────────────────────────────────────────────────────

export async function getDailySummary(): Promise<DailySummary> {
  if (native()) return nativeDailySummary();
  const r = await fetch(`${API}/daily-summary`);
  if (!r.ok) throw new Error("Could not load summary.");
  const summary = await r.json() as Partial<DailySummary>;
  const plannedGoal = summary.planned_goal ?? summary.adjusted_goal ?? summary.daily_goal ?? 0;
  return {
    ...summary,
    planned_goal: plannedGoal,
    carryover_adjustment: summary.carryover_adjustment ?? ((summary.adjusted_goal ?? plannedGoal) - plannedGoal),
    target_source: summary.target_source ?? "manual",
    plan_day_kind: summary.plan_day_kind ?? null,
    rewards_enabled: summary.rewards_enabled ?? false,
    challenge_completed_message: summary.challenge_completed_message ?? "",
  } as DailySummary;
}

export async function getDailyMacroSummary(): Promise<DailyMacroSummary> {
  const emptyMacros = { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  if (native()) {
    const db = await getDb();
    const today = getToday();
    const jsDay = new Date(`${today}T00:00:00`).getDay();
    const weekday = (jsDay + 6) % 7;
    const [consumedResult, targetResult] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(total_protein_g), 0) AS protein_g,
                COALESCE(SUM(total_carbs_g), 0) AS carbs_g,
                COALESCE(SUM(total_fat_g), 0) AS fat_g,
                COALESCE(SUM(total_fiber_g), 0) AS fiber_g
         FROM meals WHERE date=?`,
        [today]
      ),
      db.query(
        `SELECT p.id AS plan_id, d.protein_g, d.carbs_g, d.fat_g, d.fiber_g
         FROM nutrition_plans p
         JOIN nutrition_plan_days d ON d.plan_id=p.id
         WHERE p.is_active=1 AND d.weekday=?
         ORDER BY p.created_at DESC, p.id DESC LIMIT 1`,
        [weekday]
      ),
    ]);
    const consumed = consumedResult.values?.[0] ?? emptyMacros;
    const target = targetResult.values?.[0];
    return {
      consumed: {
        protein_g: roundMacro(consumed.protein_g as number),
        carbs_g: roundMacro(consumed.carbs_g as number),
        fat_g: roundMacro(consumed.fat_g as number),
        fiber_g: roundMacro(consumed.fiber_g as number),
      },
      target: target ? {
        protein_g: target.protein_g as number,
        carbs_g: target.carbs_g as number,
        fat_g: target.fat_g as number,
        fiber_g: target.fiber_g as number,
      } : emptyMacros,
      plan_id: target ? target.plan_id as number : null,
    };
  }

  try {
    const meals = await getMeals();
    return {
      consumed: {
        protein_g: roundMacro(meals.reduce((sum, meal) => sum + (meal.total_protein_g ?? 0), 0)),
        carbs_g: roundMacro(meals.reduce((sum, meal) => sum + (meal.total_carbs_g ?? 0), 0)),
        fat_g: roundMacro(meals.reduce((sum, meal) => sum + (meal.total_fat_g ?? 0), 0)),
        fiber_g: roundMacro(meals.reduce((sum, meal) => sum + (meal.total_fiber_g ?? 0), 0)),
      },
      target: emptyMacros,
      plan_id: null,
    };
  } catch {
    return { consumed: emptyMacros, target: emptyMacros, plan_id: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: History
// ─────────────────────────────────────────────────────────────────────────────

export async function getHistory(): Promise<HistoryDay[]> {
  if (native()) {
    const db = await getDb();
    const { values } = await db.query(
      "SELECT date, SUM(total_calories) as total_calories FROM meals GROUP BY date ORDER BY date DESC"
    );
    return (values ?? []).map((r) => ({ date: r.date as string, total_calories: r.total_calories as number }));
  }
  const r = await fetch(`${API}/history`);
  if (!r.ok) throw new Error("Could not load history.");
  return r.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Meals
// ─────────────────────────────────────────────────────────────────────────────

export async function getMeals(dateFilter?: string): Promise<MealRecord[]> {
  if (native()) {
    const db = await getDb();
    const d = dateFilter ?? getToday();
    const { values: meals } = await db.query(
      `SELECT id, date, total_calories, total_protein_g, total_carbs_g,
              total_fat_g, total_fiber_g
       FROM meals WHERE date=? ORDER BY created_at DESC, id DESC`,
      [d]
    );
    const result: MealRecord[] = [];
    for (const meal of meals ?? []) {
      const { values: items } = await db.query(
        `SELECT name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g
         FROM meal_items WHERE meal_id=? ORDER BY id`,
        [meal.id]
      );
      result.push({
        id: meal.id as number,
        date: meal.date as string,
        total_calories: meal.total_calories as number,
        items: (items ?? []).map((i) => ({
          name: i.name as string,
          quantity: i.quantity as number,
          unit: i.unit as Unit,
          calories: i.calories as number,
          protein_g: i.protein_g as number,
          carbs_g: i.carbs_g as number,
          fat_g: i.fat_g as number,
          fiber_g: i.fiber_g as number,
        })),
        total_protein_g: meal.total_protein_g as number,
        total_carbs_g: meal.total_carbs_g as number,
        total_fat_g: meal.total_fat_g as number,
        total_fiber_g: meal.total_fiber_g as number,
      });
    }
    return result;
  }
  const url = dateFilter ? `${API}/meals?date_filter=${dateFilter}` : `${API}/meals`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load meals.");
  return r.json();
}

export async function deleteMeal(id: number): Promise<void> {
  if (native()) {
    const db = await getDb();
    await inTransaction(db, async () => {
      await db.run("DELETE FROM planned_meal_logs WHERE meal_id=?", [id], false);
      const { changes } = await db.run("DELETE FROM meals WHERE id=?", [id], false);
      if (!changes?.changes) throw new Error("Meal not found.");
    });
    return;
  }
  const r = await fetch(`${API}/meal/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Could not delete meal.");
}

export async function deleteHistoryDay(day: string): Promise<void> {
  if (native()) {
    const db = await getDb();
    await inTransaction(db, async () => {
      await db.run("DELETE FROM planned_meal_logs WHERE logged_on=?", [day], false);
      const { changes } = await db.run("DELETE FROM meals WHERE date=?", [day], false);
      if (!changes?.changes) throw new Error("No meals found for that date.");
    });
    return;
  }
  const r = await fetch(`${API}/history/${day}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Could not delete day.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Log meal
// ─────────────────────────────────────────────────────────────────────────────

export async function logMeal(
  items: { name: string; quantity: number; unit: string }[]
): Promise<MealSummary> {
  if (native()) {
    const db = await getDb();
    const today = getToday();

    // Look up foods
    const { values: foodRows } = await db.query(
      `SELECT name, unit, reference_quantity, reference_calories,
              protein_g, carbs_g, fat_g, fiber_g
       FROM foods`
    );
    const foodDb: Record<string, {
      unit: string;
      ref_qty: number;
      ref_cal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g: number;
    }> = {};
    for (const f of foodRows ?? []) {
      foodDb[f.name as string] = {
        unit: f.unit as string,
        ref_qty: f.reference_quantity as number,
        ref_cal: f.reference_calories as number,
        protein_g: f.protein_g as number,
        carbs_g: f.carbs_g as number,
        fat_g: f.fat_g as number,
        fiber_g: f.fiber_g as number,
      };
    }

    const calculated: MealItem[] = [];
    for (const item of items) {
      const name = item.name.trim().toLowerCase();
      const unit = normalizeUnit(item.unit);
      const food = foodDb[name];
      if (!food) throw new Error(`Unknown food: ${name}`);
      if (unit !== food.unit) throw new Error(`${name} must be logged in ${food.unit}`);
      const ratio = item.quantity / food.ref_qty;
      calculated.push({
        name,
        quantity: item.quantity,
        unit,
        calories: Math.round(ratio * food.ref_cal),
        protein_g: roundMacro(ratio * food.protein_g),
        carbs_g: roundMacro(ratio * food.carbs_g),
        fat_g: roundMacro(ratio * food.fat_g),
        fiber_g: roundMacro(ratio * food.fiber_g),
      });
    }

    const totalCalories = calculated.reduce((s, i) => s + i.calories, 0);
    const totalProtein = roundMacro(calculated.reduce((s, i) => s + i.protein_g, 0));
    const totalCarbs = roundMacro(calculated.reduce((s, i) => s + i.carbs_g, 0));
    const totalFat = roundMacro(calculated.reduce((s, i) => s + i.fat_g, 0));
    const totalFiber = roundMacro(calculated.reduce((s, i) => s + i.fiber_g, 0));

    const { changes } = await db.run(
      `INSERT INTO meals (
         date, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [today, totalCalories, totalProtein, totalCarbs, totalFat, totalFiber]
    );
    const mealId = changes?.lastId as number;

    for (const item of calculated) {
      await db.run(
        `INSERT INTO meal_items (
           meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mealId, item.name, item.quantity, item.unit, item.calories,
          item.protein_g, item.carbs_g, item.fat_g, item.fiber_g,
        ]
      );
    }

    const summary = await nativeDailySummary(today);
    const milestoneKey = detectMilestoneKey(summary, totalCalories);

    const rewardRuntime = await loadRewardRuntime(db);
    const basePoints = configuredPointValue(rewardRuntime, "log_meal");
    if (basePoints > 0) await db.run("INSERT INTO heart_points_log (source, points) VALUES (?, ?)", ["log_meal", basePoints]);

    let bonusPoints = 0;
    if (milestoneKey && milestoneKey !== "first_meal_today") {
      bonusPoints = configuredPointValue(rewardRuntime, milestoneKey);
      if (bonusPoints > 0) {
        await db.run("INSERT INTO heart_points_log (source, points) VALUES (?, ?)", [milestoneKey, bonusPoints]);
      }
    }

    const dayIdx = getDayOfYear(new Date());
    let milestone: string | null = null;
    if (milestoneKey && rewardRuntime.preferences.enabled && rewardRuntime.preferences.motivations_enabled) {
      const messages = rewardMessagePool(rewardRuntime, "milestone", milestoneKey);
      if (messages.length) milestone = pick(messages, dayIdx);
    }

    return {
      id: mealId,
      date: today,
      items: calculated,
      total_calories: totalCalories,
      total_protein_g: totalProtein,
      total_carbs_g: totalCarbs,
      total_fat_g: totalFat,
      total_fiber_g: totalFiber,
      daily_total: summary.consumed,
      remaining: summary.remaining,
      milestone,
      heart_points_earned: basePoints + bonusPoints,
    };
  }

  const r = await fetch(`${API}/log-meal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!r.ok) {
    const p = await r.json();
    throw new Error(typeof p.detail === "string" ? p.detail : "Could not log meal.");
  }
  return r.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Foods
// ─────────────────────────────────────────────────────────────────────────────

export async function getFoods(): Promise<Food[]> {
  if (native()) {
    const db = await getDb();
    const { values } = await db.query(
      `SELECT id, name, unit, reference_quantity, reference_calories,
              protein_g, carbs_g, fat_g, fiber_g, source
       FROM foods ORDER BY name`
    );
    return (values ?? []).map((f) => ({
      id: f.id as number,
      name: f.name as string,
      unit: f.unit as Unit,
      reference_quantity: f.reference_quantity as number,
      reference_calories: f.reference_calories as number,
      protein_g: f.protein_g as number,
      carbs_g: f.carbs_g as number,
      fat_g: f.fat_g as number,
      fiber_g: f.fiber_g as number,
      source: f.source as "manual" | "label_scan",
    }));
  }
  const r = await fetch(`${API}/foods`);
  if (!r.ok) throw new Error("Could not load foods.");
  return r.json();
}

export async function upsertFood(
  food: {
    name: string;
    unit: string;
    reference_quantity: number;
    reference_calories: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    source?: "manual" | "label_scan";
  }
): Promise<Food> {
  if (native()) {
    const db = await getDb();
    const name = food.name.trim().toLowerCase();
    const unit = normalizeUnit(food.unit);
    await db.run(
      `INSERT INTO foods (
         name, unit, reference_quantity, reference_calories,
         protein_g, carbs_g, fat_g, fiber_g, source, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(name) DO UPDATE SET
         unit=excluded.unit,
         reference_quantity=excluded.reference_quantity,
         reference_calories=excluded.reference_calories,
         protein_g=excluded.protein_g,
         carbs_g=excluded.carbs_g,
         fat_g=excluded.fat_g,
         fiber_g=excluded.fiber_g,
         source=excluded.source,
         updated_at=datetime('now')`,
      [
        name, unit, food.reference_quantity, food.reference_calories,
        food.protein_g ?? 0, food.carbs_g ?? 0, food.fat_g ?? 0, food.fiber_g ?? 0,
        food.source ?? "manual",
      ]
    );
    const { values } = await db.query(
      `SELECT id, name, unit, reference_quantity, reference_calories,
              protein_g, carbs_g, fat_g, fiber_g, source
       FROM foods WHERE name=?`,
      [name]
    );
    const f = values![0];
    return rowToFood(f);
  }
  const r = await fetch(`${API}/foods`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(food),
  });
  if (!r.ok) { const p = await r.json(); throw new Error(typeof p.detail === "string" ? p.detail : "Could not save food."); }
  return r.json();
}

export async function updateFood(
  id: number,
  food: {
    name: string;
    unit: string;
    reference_quantity: number;
    reference_calories: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    source?: "manual" | "label_scan";
  }
): Promise<Food> {
  if (native()) {
    const db = await getDb();
    const name = food.name.trim().toLowerCase();
    const unit = normalizeUnit(food.unit);
    const { changes } = await db.run(
      `UPDATE foods SET
         name=?, unit=?, reference_quantity=?, reference_calories=?,
         protein_g=?, carbs_g=?, fat_g=?, fiber_g=?, source=?, updated_at=datetime('now')
       WHERE id=?`,
      [
        name, unit, food.reference_quantity, food.reference_calories,
        food.protein_g ?? 0, food.carbs_g ?? 0, food.fat_g ?? 0, food.fiber_g ?? 0,
        food.source ?? "manual", id,
      ]
    );
    if (!changes?.changes) throw new Error("Food not found.");
    const { values } = await db.query(
      `SELECT id, name, unit, reference_quantity, reference_calories,
              protein_g, carbs_g, fat_g, fiber_g, source
       FROM foods WHERE id=?`,
      [id]
    );
    const f = values![0];
    return rowToFood(f);
  }
  const r = await fetch(`${API}/foods/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(food),
  });
  if (!r.ok) { const p = await r.json(); throw new Error(typeof p.detail === "string" ? p.detail : "Could not update food."); }
  return r.json();
}

export async function deleteFood(id: number): Promise<void> {
  if (native()) {
    const db = await getDb();
    await db.run("DELETE FROM foods WHERE id=?", [id]);
    return;
  }
  const r = await fetch(`${API}/foods/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Could not delete food.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Settings
// ─────────────────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  if (native()) {
    const db = await getDb();
    const { values } = await db.query("SELECT * FROM settings WHERE id=1");
    const s = values![0];
    return {
      goal_mode: s.goal_mode as "daily" | "weekly",
      daily_calorie_goal: s.daily_calorie_goal as number,
      weekly_calorie_goal: s.weekly_calorie_goal as number,
      history_retention_days: s.history_retention_days as number,
      week_start_day: s.week_start_day as number,
      partner_name: s.partner_name as string,
      calorie_distribution_mode: s.calorie_distribution_mode as "fixed" | "flexible_weekly",
    };
  }
  const r = await fetch(`${API}/settings`);
  if (!r.ok) throw new Error("Could not load settings.");
  return r.json();
}

export async function updateSettings(
  update: Partial<{
    goal_mode: string;
    daily_calorie_goal: number;
    weekly_calorie_goal: number;
    history_retention_days: number;
    week_start_day: number;
    partner_name: string;
    calorie_distribution_mode: "fixed" | "flexible_weekly";
  }>
): Promise<DailySummary> {
  if (native()) {
    const db = await getDb();
    const { values } = await db.query("SELECT * FROM settings WHERE id=1");
    const cur = values![0] as Record<string, unknown>;

    let goalMode = (update.goal_mode ?? cur.goal_mode) as string;
    let dailyGoal = (update.daily_calorie_goal ?? cur.daily_calorie_goal) as number;
    let weeklyGoal = (update.weekly_calorie_goal ?? cur.weekly_calorie_goal) as number;
    const retention = (update.history_retention_days ?? cur.history_retention_days) as number;
    const weekStartDay = (update.week_start_day ?? cur.week_start_day) as number;
    const partnerName = (update.partner_name ?? cur.partner_name) as string;
    const distributionMode = (update.calorie_distribution_mode ?? cur.calorie_distribution_mode) as string;

    if (goalMode === "daily") weeklyGoal = dailyGoal * 7;
    else if (goalMode === "weekly") dailyGoal = Math.round(weeklyGoal / 7);

    await db.run(
      `UPDATE settings SET
         goal_mode=?, daily_calorie_goal=?, weekly_calorie_goal=?, history_retention_days=?,
         week_start_day=?, partner_name=?, calorie_distribution_mode=?
       WHERE id=1`,
      [goalMode, dailyGoal, weeklyGoal, retention, weekStartDay, partnerName, distributionMode]
    );
    return nativeDailySummary();
  }
  const r = await fetch(`${API}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!r.ok) { const p = await r.json(); throw new Error(typeof p.detail === "string" ? p.detail : "Could not save settings."); }
  return r.json();
}

export async function completeChallenge(): Promise<void> {
  if (native()) {
    const db = await getDb();
    const summary = await nativeDailySummary();
    if (!summary.current_challenge || summary.challenge_completed) return;
    await inTransaction(db, async () => {
      const { changes } = await db.run(
        "UPDATE settings SET challenge_completed_week=? WHERE id=1 AND challenge_completed_week<>?",
        [summary.week_start, summary.week_start],
        false
      );
      if (changes?.changes) await awardConfiguredPoints(db, "weekly_challenge", false);
    });
    return;
  }
  await fetch(`${API}/challenge/complete`, { method: "POST" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Love note
// ─────────────────────────────────────────────────────────────────────────────

export async function getLoveNote(): Promise<string | null> {
  return getConfiguredLoveNote();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Heart points
// ─────────────────────────────────────────────────────────────────────────────

export async function getHeartPoints(): Promise<HeartPointsBalance> {
  if (native()) {
    const db = await getDb();
    const runtime = await loadRewardRuntime(db);
    const { values: settingRows } = await db.query("SELECT week_start_day FROM settings WHERE id=1");
    const weekStartDay = Number(settingRows?.[0]?.week_start_day ?? 0);
    const now = new Date();
    const weekday = (now.getDay() + 6) % 7;
    const daysSince = ((weekday - weekStartDay) % 7 + 7) % 7;
    const weekStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSince);
    const weekStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, "0")}-${String(weekStartDate.getDate()).padStart(2, "0")}`;
    const [earnedR, spentR, weeklyR, logR, redemptionR, rewardR] = await Promise.all([
      db.query("SELECT COALESCE(SUM(points),0) as v FROM heart_points_log"),
      db.query("SELECT COALESCE(SUM(points_spent),0) as v FROM redemptions"),
      db.query("SELECT COALESCE(SUM(points),0) as v FROM heart_points_log WHERE date(created_at)>=?", [weekStart]),
      db.query("SELECT h.id, h.source, COALESCE(r.label, h.source) AS source_label, h.points, h.created_at FROM heart_points_log h LEFT JOIN point_rules r ON r.action_key=h.source ORDER BY h.id DESC LIMIT 20"),
      db.query("SELECT id, reward, points_spent, created_at, claimed, claimed_at FROM redemptions ORDER BY id DESC"),
      db.query("SELECT id, name, cost FROM rewards_catalogue WHERE enabled=1 ORDER BY id"),
    ]);
    const balance = (earnedR.values![0].v as number) - (spentR.values![0].v as number);
    const rewards: RewardItem[] = (rewardR.values ?? []).map((row) => ({ id: Number(row.id), name: String(row.name), cost: Number(row.cost) }));
    const redemptions: Redemption[] = (redemptionR.values ?? []).map((r) => ({
      id: r.id as number,
      reward: r.reward as string,
      points_spent: r.points_spent as number,
      created_at: r.created_at as string,
      claimed: Boolean(r.claimed),
      claimed_at: r.claimed_at as string | null,
    }));
    return {
      enabled: runtime.preferences.enabled && runtime.preferences.points_enabled,
      system_name: runtime.preferences.system_name,
      point_name_plural: runtime.preferences.point_name_plural,
      balance,
      weekly_earned: Number(weeklyR.values?.[0]?.v ?? 0),
      weekly_goal: runtime.preferences.weekly_points_goal,
      redemption_pending_message: pickOptional(rewardMessagePool(runtime, "redemption_pending"), 0),
      redemption_claimed_message: pickOptional(rewardMessagePool(runtime, "redemption_claimed"), 0),
      log: (logR.values ?? []).map((r) => ({ id: r.id as number, source: r.source_label as string, points: r.points as number, created_at: r.created_at as string })),
      rewards,
      redemptions,
    };
  }
  const r = await fetch(`${API}/heart-points`);
  if (!r.ok) throw new Error("Could not load heart points.");
  return r.json();
}

export async function redeemReward(rewardId: number): Promise<{ redeemed: string; new_balance: number }> {
  if (native()) {
    const db = await getDb();
    return inTransaction(db, async () => {
      const runtime = await loadRewardRuntime(db);
      if (!runtime.preferences.enabled || !runtime.preferences.points_enabled) throw new Error("Rewards are disabled in Settings.");
      const { values: rewardRows } = await db.query("SELECT name, cost FROM rewards_catalogue WHERE id=? AND enabled=1", [rewardId]);
      const reward = rewardRows?.[0];
      if (!reward) throw new Error("Reward not found.");
      const name = String(reward.name); const cost = Number(reward.cost);
      const [earnedR, spentR] = await Promise.all([
        db.query("SELECT COALESCE(SUM(points),0) as v FROM heart_points_log"),
        db.query("SELECT COALESCE(SUM(points_spent),0) as v FROM redemptions"),
      ]);
      const balance = Number(earnedR.values?.[0]?.v ?? 0) - Number(spentR.values?.[0]?.v ?? 0);
      if (balance < cost) throw new Error(`Not enough ${runtime.preferences.point_name_plural}. Need ${cost}, have ${balance}.`);
      await db.run("INSERT INTO redemptions (reward, points_spent) VALUES (?, ?)", [name, cost], false);
      return { redeemed: name, new_balance: balance - cost };
    });
  }
  const r = await fetch(`${API}/heart-points/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reward_id: rewardId }),
  });
  if (!r.ok) { const p = await r.json(); throw new Error(typeof p.detail === "string" ? p.detail : "Redemption failed."); }
  return r.json();
}

export async function claimRedemption(id: number): Promise<void> {
  if (native()) {
    const db = await getDb();
    const now = new Date().toISOString().slice(0, 19);
    await db.run("UPDATE redemptions SET claimed=1, claimed_at=? WHERE id=?", [now, id]);
    return;
  }
  const r = await fetch(`${API}/heart-points/claim/${id}`, { method: "POST" });
  if (!r.ok) throw new Error("Could not claim reward.");
}

export async function purgeOldHistory(): Promise<void> {
  if (!native()) return;
  const db = await getDb();
  const { values } = await db.query("SELECT history_retention_days FROM settings WHERE id=1");
  const days = values![0].history_retention_days as number;
  if (!days) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  await db.run("DELETE FROM meals WHERE date<?", [cutoff.toISOString().slice(0, 10)]);
}
