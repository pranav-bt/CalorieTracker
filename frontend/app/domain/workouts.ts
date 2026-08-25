import type { ExerciseTrackingType, UserProfile, WorkoutPlanDay, WorkoutPrescription, WorkoutStyle } from "../types";

export type GeneratedWorkoutPlan = {
  name: string;
  goal: string;
  explanation: string;
  days: WorkoutPlanDay[];
};

type ExerciseTemplate = Omit<WorkoutPrescription, "order_index" | "id">;

export function generateWorkoutPlan(profile: UserProfile): GeneratedWorkoutPlan {
  if (profile.workout_days_per_week < 1) throw new Error("Choose at least one workout day to generate a plan.");
  const days = profile.preferred_workout_days;
  if (days.length !== profile.workout_days_per_week) {
    throw new Error("Preferred workout days must match the selected number of sessions.");
  }
  const equipment = profile.available_equipment.map((item) => item.toLowerCase()).join(" ");
  const baseStrength = chooseStrengthTemplates(equipment);
  const event = profile.event_name.toLowerCase();
  const performance = profile.primary_goal === "performance" || /marathon|run|race|hyrox/.test(event);
  const requestedStyle = normalizeStyle(profile.workout_style);
  const style = requestedStyle === "balanced" && performance
    ? (/hyrox/.test(event) ? "hybrid" : "endurance")
    : requestedStyle;
  const strength = adaptStrengthTemplates(baseStrength, style);
  const sessions = buildSessionSequence(profile.workout_days_per_week, strength, style, event, profile.workout_session_minutes);

  return {
    name: performance && profile.event_name
      ? `${profile.event_name} ${styleName(style)}`
      : `${styleName(style)} foundation`,
    goal: profile.primary_goal,
    explanation:
      `Built from ${profile.workout_days_per_week} available day${profile.workout_days_per_week === 1 ? "" : "s"}, ` +
      `${profile.workout_session_minutes}-minute ${styleName(style).toLowerCase()} sessions, and the equipment entered in your profile. ` +
      (profile.injuries_or_limitations.length
        ? "Limitations were recorded but require your review before starting; the template does not diagnose or treat injuries."
        : "Start conservatively and record pain, effort, and recovery after every session."),
    days: days.map((weekday, index) => ({
      weekday,
      title: sessions[index].title,
      focus: sessions[index].focus,
      estimated_minutes: profile.workout_session_minutes,
      exercises: sessions[index].exercises.map((exercise, orderIndex) => ({ ...exercise, order_index: orderIndex })),
    })),
  };
}

function buildSessionSequence(
  count: number,
  strength: { a: ExerciseTemplate[]; b: ExerciseTemplate[] },
  style: WorkoutStyle,
  event: string,
  sessionMinutes: number
): Array<{ title: string; focus: string; exercises: ExerciseTemplate[] }> {
  const warmupMinutes = Math.max(2, Math.round(sessionMinutes * 0.2));
  const cooldownMinutes = Math.max(2, Math.round(sessionMinutes * 0.15));
  const workingMinutes = Math.max(4, sessionMinutes - warmupMinutes - cooldownMinutes);
  const strengthA = { title: "Full body A", focus: "strength", exercises: strength.a };
  const strengthB = { title: "Full body B", focus: "strength", exercises: strength.b };
  const easyCardio = { title: "Easy aerobic", focus: "endurance", exercises: [cardio("Easy cardio", Math.max(10, Math.round(sessionMinutes * 0.8)) * 60, 4)] };
  const longCardio = { title: "Long aerobic", focus: "endurance", exercises: [cardio("Long easy cardio", sessionMinutes * 60, 4)] };
  const tempo = { title: "Tempo conditioning", focus: "conditioning", exercises: [
    cardio("Easy warm-up", warmupMinutes * 60, 3), cardio("Steady tempo", workingMinutes * 60, 6), cardio("Easy cool-down", cooldownMinutes * 60, 2),
  ] };
  const intervals = { title: "Controlled intervals", focus: "conditioning", exercises: [
    cardio("Warm-up", warmupMinutes * 60, 3), cardio("Intervals", workingMinutes * 60, 7), cardio("Cool-down", cooldownMinutes * 60, 2),
  ] };
  const mixed = { title: /hyrox/.test(event) ? "Hyrox foundation" : "Mixed conditioning", focus: "hybrid", exercises: [
    ...strength.a.slice(0, 2).map((exercise) => ({ ...exercise, target_sets: Math.min(exercise.target_sets ?? 3, 3) })),
    cardio("Run or brisk incline walk", Math.max(5, Math.round(sessionMinutes * 0.4)) * 60, 6), timed("Loaded carry or marching hold", 4, 45),
  ] };
  const mobility = { title: "Mobility and recovery", focus: "recovery", exercises: [timed("Mobility flow", 1, sessionMinutes * 60)] };
  const stability = { title: "Mobility and stability", focus: "recovery", exercises: [
    timed("Joint mobility flow", 1, 10 * 60), timed("Balance practice", 3, 40), timed("Core stability circuit", 3, 60),
  ] };

  const pools: Record<WorkoutStyle, Array<{ title: string; focus: string; exercises: ExerciseTemplate[] }>> = {
    balanced: [strengthA, strengthB, intervals, strengthA, strengthB, easyCardio, mobility],
    strength: [strengthA, strengthB, strengthA, strengthB, mobility],
    hypertrophy: [strengthA, strengthB, strengthA, strengthB, easyCardio],
    endurance: [easyCardio, intervals, longCardio, tempo, strengthA, mobility],
    hybrid: [strengthA, mixed, strengthB, intervals, easyCardio, mobility],
    mobility: [mobility, stability, easyCardio, mobility, stability],
  };
  const pool = pools[style];
  return Array.from({ length: count }, (_, index) => pool[index % pool.length]);
}

function chooseStrengthTemplates(equipment: string): { a: ExerciseTemplate[]; b: ExerciseTemplate[] } {
  if (/barbell|gym|rack/.test(equipment)) return {
    a: [strengthExercise("Back squat", 3, 6, 10), strengthExercise("Bench press", 3, 6, 10), strengthExercise("Cable or machine row", 3, 8, 12), timed("Plank", 3, 40)],
    b: [strengthExercise("Romanian deadlift", 3, 6, 10), strengthExercise("Overhead press", 3, 6, 10), strengthExercise("Lat pulldown", 3, 8, 12), strengthExercise("Split squat", 3, 8, 12)],
  };
  if (/dumbbell|kettlebell/.test(equipment)) return {
    a: [strengthExercise("Goblet squat", 3, 8, 12), strengthExercise("Dumbbell floor press", 3, 8, 12), strengthExercise("One-arm dumbbell row", 3, 8, 12), timed("Plank", 3, 40)],
    b: [strengthExercise("Dumbbell Romanian deadlift", 3, 8, 12), strengthExercise("Dumbbell overhead press", 3, 8, 12), strengthExercise("Reverse lunge", 3, 8, 12), timed("Farmer carry", 4, 45)],
  };
  if (/band|resistance/.test(equipment)) return {
    a: [strengthExercise("Banded squat", 3, 10, 15), strengthExercise("Band chest press", 3, 8, 15), strengthExercise("Seated band row", 3, 10, 15), timed("Pallof press hold", 3, 30)],
    b: [strengthExercise("Band Romanian deadlift", 3, 10, 15), strengthExercise("Band overhead press", 3, 8, 15), strengthExercise("Lateral band walk", 3, 10, 20), strengthExercise("Band curl", 3, 10, 15)],
  };
  return {
    a: [strengthExercise("Bodyweight squat", 3, 10, 20), strengthExercise("Push-up", 3, 5, 15), strengthExercise("Glute bridge", 3, 10, 20), timed("Plank", 3, 30)],
    b: [strengthExercise("Reverse lunge", 3, 8, 15), strengthExercise("Incline push-up", 3, 8, 15), strengthExercise("Prone reverse snow angel", 3, 10, 15), timed("Side plank", 3, 25)],
  };
}

function adaptStrengthTemplates(
  templates: { a: ExerciseTemplate[]; b: ExerciseTemplate[] },
  style: WorkoutStyle
): { a: ExerciseTemplate[]; b: ExerciseTemplate[] } {
  const adapt = (exercise: ExerciseTemplate): ExerciseTemplate => {
    if (exercise.tracking_type !== "strength") return exercise;
    if (style === "strength") return { ...exercise, target_sets: 4, target_reps_min: 4, target_reps_max: 8, target_rir: 2 };
    if (style === "hypertrophy") return { ...exercise, target_sets: 4, target_reps_min: 8, target_reps_max: 15, target_rir: 2 };
    return exercise;
  };
  return { a: templates.a.map(adapt), b: templates.b.map(adapt) };
}

function strengthExercise(name: string, sets: number, min: number, max: number): ExerciseTemplate {
  return prescription(name, "strength", { target_sets: sets, target_reps_min: min, target_reps_max: max, target_rir: 2 });
}

function cardio(name: string, duration: number, rpe: number): ExerciseTemplate {
  return prescription(name, "cardio", { target_sets: 1, target_duration_s: duration, target_rpe: rpe });
}

function timed(name: string, sets: number, seconds: number): ExerciseTemplate {
  return prescription(name, "timed", { target_sets: sets, target_duration_s: seconds });
}

function prescription(name: string, trackingType: ExerciseTrackingType, values: Partial<ExerciseTemplate>): ExerciseTemplate {
  return {
    exercise_name: name,
    tracking_type: trackingType,
    target_sets: null,
    target_reps_min: null,
    target_reps_max: null,
    target_load_kg: null,
    target_rir: null,
    target_rpe: null,
    target_duration_s: null,
    target_distance_m: null,
    notes: "",
    ...values,
  };
}

function normalizeStyle(style: UserProfile["workout_style"] | undefined): WorkoutStyle {
  return ["balanced", "strength", "hypertrophy", "endurance", "hybrid", "mobility"].includes(style ?? "")
    ? style as WorkoutStyle
    : "balanced";
}

function styleName(style: WorkoutStyle): string {
  const names: Record<WorkoutStyle, string> = {
    balanced: "Balanced fitness",
    strength: "Strength",
    hypertrophy: "Muscle building",
    endurance: "Endurance",
    hybrid: "Hybrid conditioning",
    mobility: "Mobility",
  };
  return names[style];
}
