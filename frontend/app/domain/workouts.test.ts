import { generateWorkoutPlan } from "./workouts";
import type { UserProfile } from "../types";

const profile: UserProfile = {
  birth_date: "1990-01-01", metabolic_sex: "female", height_cm: 165,
  activity_level: "moderate", primary_goal: "muscle_gain", physique_goal: "muscular", current_state: "fairly_lean_gain_muscle", target_weight_kg: null,
  target_date: null, event_name: "", event_date: null, workout_days_per_week: 3,
  preferred_workout_days: [0, 2, 4], workout_session_minutes: 45, workout_style: "balanced", flex_days_per_week: 0,
  flex_day_weekday: null, dietary_preferences: [], available_equipment: ["dumbbells"],
  flex_day_calorie_target: null,
  injuries_or_limitations: [],
};

describe("generateWorkoutPlan", () => {
  it("uses available days and equipment", () => {
    const result = generateWorkoutPlan(profile);
    expect(result.days.map((day) => day.weekday)).toEqual([0, 2, 4]);
    expect(result.days[0].exercises.some((exercise) => /Dumbbell/.test(exercise.exercise_name))).toBe(true);
  });

  it("creates event-oriented conditioning", () => {
    const result = generateWorkoutPlan({ ...profile, primary_goal: "performance", event_name: "Hyrox" });
    expect(result.days.some((day) => day.focus === "hybrid")).toBe(true);
  });

  it.each([
    ["strength", "strength"],
    ["hypertrophy", "strength"],
    ["endurance", "endurance"],
    ["hybrid", "hybrid"],
    ["mobility", "recovery"],
  ] as const)("builds the selected %s style", (workoutStyle, expectedFocus) => {
    const result = generateWorkoutPlan({ ...profile, workout_style: workoutStyle });
    expect(result.days.some((day) => day.focus === expectedFocus)).toBe(true);
    expect(result.explanation.toLowerCase()).toContain(workoutStyle === "hypertrophy" ? "muscle building" : workoutStyle);
  });

  it("uses resistance-band exercises when that is the available equipment", () => {
    const result = generateWorkoutPlan({ ...profile, available_equipment: ["resistance bands"] });
    expect(result.days.flatMap((day) => day.exercises).some((exercise) => /band/i.test(exercise.exercise_name))).toBe(true);
  });

  it("changes strength and muscle-building repetition prescriptions", () => {
    const strength = generateWorkoutPlan({ ...profile, workout_style: "strength" });
    const hypertrophy = generateWorkoutPlan({ ...profile, workout_style: "hypertrophy" });
    expect(strength.days[0].exercises[0]).toMatchObject({ target_sets: 4, target_reps_min: 4, target_reps_max: 8 });
    expect(hypertrophy.days[0].exercises[0]).toMatchObject({ target_sets: 4, target_reps_min: 8, target_reps_max: 15 });
  });

  it("scales conditioning prescriptions to the available session time", () => {
    const result = generateWorkoutPlan({ ...profile, workout_style: "endurance", workout_session_minutes: 30 });
    const intervals = result.days.find((day) => day.title === "Controlled intervals")!;
    expect(intervals.exercises.reduce((total, exercise) => total + (exercise.target_duration_s ?? 0), 0)).toBe(30 * 60);
    expect(result.days.every((day) => day.estimated_minutes === 30)).toBe(true);
  });
});
