"use client";

import { Capacitor } from "@capacitor/core";
import { generateWorkoutPlan } from "../domain/workouts";
import type {
  RecalibrationChange,
  UserProfile,
  WorkoutPlan,
  WorkoutPlanDay,
  WorkoutPrescription,
  WorkoutRecalibrationReport,
  WorkoutSessionDraft,
  WorkoutSessionSummary,
} from "../types";
import { getDb } from "./client";

function requireAndroid(): void {
  if (!Capacitor.isNativePlatform()) throw new Error("Workout storage is available in the Android app.");
}

export async function generateAndSaveWorkoutPlan(profile: UserProfile): Promise<WorkoutPlan> {
  requireAndroid();
  const generated = generateWorkoutPlan(profile);
  return savePlan({ ...generated, source: "initial" }, profile);
}

async function savePlan(
  plan: Pick<WorkoutPlan, "name" | "goal" | "explanation" | "days" | "source">,
  profileSnapshot: UserProfile | Record<string, unknown>
): Promise<WorkoutPlan> {
  const db = await getDb();
  await db.execute("BEGIN TRANSACTION");
  try {
    await db.run("UPDATE workout_plans SET is_active=0 WHERE is_active=1");
    const { changes } = await db.run(
      `INSERT INTO workout_plans (
         activated_at, is_active, source, name, goal, profile_snapshot_json, explanation
       ) VALUES (datetime('now'), 1, ?, ?, ?, ?, ?)`,
      [plan.source, plan.name, plan.goal, JSON.stringify(profileSnapshot), plan.explanation]
    );
    const planId = changes?.lastId as number;
    const storedDays: WorkoutPlanDay[] = [];
    for (const day of plan.days) {
      const { changes: dayChanges } = await db.run(
        `INSERT INTO workout_plan_days (plan_id, weekday, title, focus, estimated_minutes)
         VALUES (?, ?, ?, ?, ?)`,
        [planId, day.weekday, day.title, day.focus, day.estimated_minutes]
      );
      const dayId = dayChanges?.lastId as number;
      const storedExercises: WorkoutPrescription[] = [];
      for (const exercise of day.exercises) {
        const { changes: exerciseChanges } = await db.run(
          `INSERT INTO workout_plan_exercises (
             plan_day_id, exercise_name, tracking_type, order_index, target_sets,
             target_reps_min, target_reps_max, target_load_kg, target_rir, target_rpe,
             target_duration_s, target_distance_m, notes
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dayId, exercise.exercise_name, exercise.tracking_type, exercise.order_index,
            exercise.target_sets, exercise.target_reps_min, exercise.target_reps_max,
            exercise.target_load_kg, exercise.target_rir, exercise.target_rpe,
            exercise.target_duration_s, exercise.target_distance_m, exercise.notes,
          ]
        );
        storedExercises.push({ ...exercise, id: exerciseChanges?.lastId as number });
      }
      storedDays.push({ ...day, id: dayId, exercises: storedExercises });
    }
    await db.execute("COMMIT");
    return {
      id: planId,
      created_at: new Date().toISOString(),
      activated_at: new Date().toISOString(),
      is_active: true,
      source: plan.source,
      name: plan.name,
      goal: plan.goal,
      explanation: plan.explanation,
      days: storedDays,
    };
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function getActiveWorkoutPlan(): Promise<WorkoutPlan | null> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query("SELECT * FROM workout_plans WHERE is_active=1 ORDER BY id DESC LIMIT 1");
  const row = values?.[0];
  if (!row) return null;
  const { values: dayRows } = await db.query("SELECT * FROM workout_plan_days WHERE plan_id=? ORDER BY weekday", [row.id]);
  const days: WorkoutPlanDay[] = [];
  for (const day of dayRows ?? []) {
    const { values: exerciseRows } = await db.query(
      `SELECT id, exercise_name, tracking_type, order_index, target_sets, target_reps_min,
              target_reps_max, target_load_kg, target_rir, target_rpe, target_duration_s,
              target_distance_m, notes
       FROM workout_plan_exercises WHERE plan_day_id=? ORDER BY order_index`,
      [day.id]
    );
    days.push({
      id: day.id as number,
      weekday: day.weekday as number,
      title: day.title as string,
      focus: day.focus as string,
      estimated_minutes: day.estimated_minutes as number,
      exercises: (exerciseRows ?? []) as WorkoutPrescription[],
    });
  }
  return {
    id: row.id as number,
    created_at: row.created_at as string,
    activated_at: row.activated_at as string | null,
    is_active: true,
    source: row.source as WorkoutPlan["source"],
    name: row.name as string,
    goal: row.goal as string,
    explanation: row.explanation as string,
    days,
  };
}

export async function saveWorkoutSession(session: WorkoutSessionDraft): Promise<number> {
  requireAndroid();
  const db = await getDb();
  await db.execute("BEGIN TRANSACTION");
  try {
    const now = new Date().toISOString();
    const { changes } = await db.run(
      `INSERT INTO workout_sessions (
         plan_day_id, scheduled_for, started_at, completed_at, status,
         energy_rating, recovery_rating, pain_reported, notes
       ) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
      [
        session.plan_day_id, session.scheduled_for, now, now,
        session.energy_rating, session.recovery_rating, session.pain_reported ? 1 : 0, session.notes,
      ]
    );
    const sessionId = changes?.lastId as number;
    for (const exercise of session.exercises) {
      const { changes: logChanges } = await db.run(
        `INSERT INTO workout_exercise_logs (
           session_id, plan_exercise_id, exercise_name, order_index, notes, pain_reported
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          sessionId, exercise.plan_exercise_id, exercise.exercise_name,
          exercise.order_index, exercise.notes, exercise.pain_reported ? 1 : 0,
        ]
      );
      const exerciseLogId = logChanges?.lastId as number;
      for (const set of exercise.sets) {
        await db.run(
          `INSERT INTO workout_sets (
             exercise_log_id, set_number, reps, load_kg, rir, rpe,
             duration_seconds, distance_meters, completed
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            exerciseLogId, set.set_number, set.reps, set.load_kg, set.rir, set.rpe,
            set.duration_seconds, set.distance_meters, set.completed ? 1 : 0,
          ]
        );
      }
    }
    await db.execute("COMMIT");
    return sessionId;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function getRecentWorkoutSessions(limit = 12): Promise<WorkoutSessionSummary[]> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query(
    `SELECT s.id, s.scheduled_for, COALESCE(d.title, 'Workout') AS title, s.status,
            s.energy_rating, s.recovery_rating, s.pain_reported,
            COALESCE(SUM(CASE WHEN sets.completed=1 THEN 1 ELSE 0 END), 0) AS completed_sets
     FROM workout_sessions s
     LEFT JOIN workout_plan_days d ON d.id=s.plan_day_id
     LEFT JOIN workout_exercise_logs logs ON logs.session_id=s.id
     LEFT JOIN workout_sets sets ON sets.exercise_log_id=logs.id
     GROUP BY s.id ORDER BY s.scheduled_for DESC, s.id DESC LIMIT ?`,
    [limit]
  );
  return (values ?? []).map((row) => ({
    id: row.id as number,
    scheduled_for: row.scheduled_for as string,
    title: row.title as string,
    status: row.status as string,
    energy_rating: row.energy_rating as number | null,
    recovery_rating: row.recovery_rating as number | null,
    pain_reported: Boolean(row.pain_reported),
    completed_sets: row.completed_sets as number,
  }));
}

export async function recalibrateWorkoutPlan(): Promise<WorkoutRecalibrationReport> {
  requireAndroid();
  const db = await getDb();
  const active = await getActiveWorkoutPlan();
  if (!active) throw new Error("Create a workout plan before recalibrating.");
  const sessions = await getRecentWorkoutSessions(12);
  if (sessions.length < 2) throw new Error("Log at least two workouts before recalibrating.");

  const changes: RecalibrationChange[] = [];
  const revisedDays: WorkoutPlanDay[] = [];
  for (const day of active.days) {
    const exercises: WorkoutPrescription[] = [];
    for (const exercise of day.exercises) {
      const revised = { ...exercise };
      const { values } = await db.query(
        `SELECT logs.id AS log_id, logs.pain_reported, sessions.pain_reported AS session_pain,
                sets.reps, sets.load_kg, sets.rir, sets.rpe, sets.completed, sessions.scheduled_for
         FROM workout_exercise_logs logs
         JOIN workout_sessions sessions ON sessions.id=logs.session_id
         JOIN workout_sets sets ON sets.exercise_log_id=logs.id
         WHERE lower(logs.exercise_name)=lower(?)
         ORDER BY sessions.scheduled_for DESC, logs.id DESC, sets.set_number`,
        [exercise.exercise_name]
      );
      const recentLogs = groupLatestLogs(values ?? [], 2);
      if (recentLogs.length === 2) {
        const pain = recentLogs.some((log) => log.some((row) => Boolean(row.pain_reported) || Boolean(row.session_pain)));
        const successful = recentLogs.every((log) => log.every((row) =>
          Boolean(row.completed) &&
          (exercise.tracking_type !== "strength" || (
            row.reps !== null &&
            (exercise.target_reps_min === null || Number(row.reps) >= exercise.target_reps_min) &&
            (exercise.target_rir === null || (row.rir !== null && Number(row.rir) >= exercise.target_rir))
          )) &&
          (exercise.tracking_type !== "cardio" || exercise.target_rpe === null || (
            row.rpe !== null && Number(row.rpe) <= exercise.target_rpe
          ))
        ));
        if (pain) {
          changes.push({ area: "workout", field: exercise.exercise_name, previous_value: "Progression due", new_value: "Held", reason: "Pain was reported in a recent session, so automatic progression was stopped." });
        } else if (successful && exercise.tracking_type === "strength") {
          const latestLoads = recentLogs[0].map((row) => Number(row.load_kg)).filter((value) => value > 0);
          if (latestLoads.length) {
            const previousLoad = Math.max(...latestLoads);
            revised.target_load_kg = Math.round((previousLoad + 2.5) * 2) / 2;
            changes.push({ area: "workout", field: `${exercise.exercise_name} load`, previous_value: previousLoad, new_value: revised.target_load_kg, reason: "Two consecutive sessions met the repetition target with the planned effort reserve." });
          } else if (revised.target_reps_max !== null) {
            const previousMax = revised.target_reps_max;
            revised.target_reps_max = previousMax + 1;
            changes.push({ area: "workout", field: `${exercise.exercise_name} reps`, previous_value: previousMax, new_value: revised.target_reps_max, reason: "Two consecutive bodyweight sessions met the current target." });
          }
        } else if (successful && exercise.tracking_type === "cardio" && revised.target_duration_s) {
          const previousMinutes = Math.round(revised.target_duration_s / 60);
          revised.target_duration_s += 300;
          changes.push({ area: "workout", field: `${exercise.exercise_name} duration`, previous_value: previousMinutes, new_value: previousMinutes + 5, reason: "Two consecutive sessions were completed at or below the planned effort." });
        }
      }
      exercises.push(revised);
    }
    revisedDays.push({ ...day, id: undefined, exercises: exercises.map((exercise) => ({ ...exercise, id: undefined })) });
  }

  let newPlanId: number | null = null;
  if (changes.some((change) => change.new_value !== "Held")) {
    const revised = await savePlan({
      name: active.name,
      goal: active.goal,
      explanation: `${active.explanation} Recalibrated from completed session data.`,
      days: revisedDays,
      source: "recalibration",
    }, { previous_workout_plan_id: active.id });
    newPlanId = revised.id;
  }
  const confidence = sessions.length >= 6 ? "high" : sessions.length >= 3 ? "medium" : "low";
  const evidence = [
    `${sessions.length} recent completed workout${sessions.length === 1 ? "" : "s"}`,
    "Set completion, repetitions, load, RIR/RPE, and pain reports",
    "Progression requires two consecutive successful entries for the same exercise",
  ];
  const summary = changes.length ? `${changes.length} workout decision${changes.length === 1 ? " was" : "s were"} recorded.` : "No exercises had enough consistent evidence to change.";
  const { changes: reportChanges } = await db.run(
    `INSERT INTO workout_recalibration_reports (
       previous_workout_plan_id, new_workout_plan_id, confidence, summary, evidence_json, changes_json
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [active.id, newPlanId, confidence, summary, JSON.stringify(evidence), JSON.stringify(changes)]
  );
  return { id: reportChanges?.lastId as number, created_at: new Date().toISOString(), confidence, summary, evidence, changes };
}

export async function getLatestWorkoutRecalibrationReport(): Promise<WorkoutRecalibrationReport | null> {
  requireAndroid();
  const db = await getDb();
  const { values } = await db.query("SELECT * FROM workout_recalibration_reports ORDER BY id DESC LIMIT 1");
  const row = values?.[0];
  if (!row) return null;
  return {
    id: row.id as number,
    created_at: row.created_at as string,
    confidence: row.confidence as WorkoutRecalibrationReport["confidence"],
    summary: row.summary as string,
    evidence: JSON.parse(row.evidence_json as string),
    changes: JSON.parse(row.changes_json as string),
  };
}

function groupLatestLogs(rows: Record<string, unknown>[], limit: number): Record<string, unknown>[][] {
  const grouped = new Map<number, Record<string, unknown>[]>();
  for (const row of rows) {
    const id = row.log_id as number;
    if (!grouped.has(id) && grouped.size >= limit) continue;
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  }
  return [...grouped.values()];
}
