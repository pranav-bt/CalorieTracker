import { generateWorkoutPlan } from "./workouts";
import type { UserProfile } from "../types";

const profile: UserProfile = {
  birth_date: "1990-01-01", metabolic_sex: "female", height_cm: 165,
  activity_level: "moderate", primary_goal: "muscle_gain", target_weight_kg: null,
  target_date: null, event_name: "", event_date: null, workout_days_per_week: 3,
  preferred_workout_days: [0, 2, 4], workout_session_minutes: 45, flex_days_per_week: 0,
  flex_day_weekday: null, dietary_preferences: [], available_equipment: ["dumbbells"],
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
});
