import type { ExerciseTrackingType, UserProfile, WorkoutPlanDay, WorkoutPrescription } from "../types";

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
  const strength = chooseStrengthTemplates(equipment);
  const event = profile.event_name.toLowerCase();
  const performance = profile.primary_goal === "performance" || /marathon|run|race|hyrox/.test(event);
  const sessions = buildSessionSequence(profile.workout_days_per_week, strength, performance, event);

  return {
    name: performance ? `${profile.event_name || "Performance"} foundation` : `${goalName(profile.primary_goal)} foundation`,
    goal: profile.primary_goal,
    explanation:
      `Built from ${profile.workout_days_per_week} available day${profile.workout_days_per_week === 1 ? "" : "s"}, ` +
      `${profile.workout_session_minutes}-minute sessions, and the equipment entered in your profile. ` +
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
  performance: boolean,
  event: string
): Array<{ title: string; focus: string; exercises: ExerciseTemplate[] }> {
  const strengthA = { title: "Full body A", focus: "strength", exercises: strength.a };
  const strengthB = { title: "Full body B", focus: "strength", exercises: strength.b };
  const easyCardio = { title: "Easy aerobic", focus: "endurance", exercises: [cardio("Easy cardio", 30 * 60, 4)] };
  const intervals = { title: "Controlled intervals", focus: "conditioning", exercises: [
    cardio("Warm-up", 8 * 60, 3), cardio("Intervals", 18 * 60, 7), cardio("Cool-down", 6 * 60, 2),
  ] };
  const hyrox = { title: "Mixed conditioning", focus: "hybrid", exercises: [
    strengthExercise("Goblet squat", 3, 8, 12), strengthExercise("Push-up", 3, 6, 15),
    cardio("Run or brisk incline walk", 20 * 60, 6), timed("Farmer carry", 4, 45),
  ] };
  const mobility = { title: "Mobility and recovery", focus: "recovery", exercises: [timed("Mobility flow", 1, 15 * 60)] };

  const pool = performance
    ? (/hyrox/.test(event) ? [strengthA, hyrox, strengthB, intervals, easyCardio, mobility] : [easyCardio, strengthA, intervals, strengthB, easyCardio, mobility])
    : [strengthA, strengthB, intervals, strengthA, strengthB, easyCardio, mobility];
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
  return {
    a: [strengthExercise("Bodyweight squat", 3, 10, 20), strengthExercise("Push-up", 3, 5, 15), strengthExercise("Glute bridge", 3, 10, 20), timed("Plank", 3, 30)],
    b: [strengthExercise("Reverse lunge", 3, 8, 15), strengthExercise("Incline push-up", 3, 8, 15), strengthExercise("Prone reverse snow angel", 3, 10, 15), timed("Side plank", 3, 25)],
  };
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

function goalName(goal: UserProfile["primary_goal"]): string {
  return goal.replace("_", " ").replace(/^./, (value) => value.toUpperCase());
}
