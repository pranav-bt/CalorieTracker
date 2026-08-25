import { Capacitor } from "@capacitor/core";
import { getDb } from "./client";
import { getExerciseProgress } from "./workouts";

jest.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: jest.fn() } }));
jest.mock("./client", () => ({ getDb: jest.fn(), inTransaction: jest.fn() }));

describe("getExerciseProgress", () => {
  it("normalizes completed-set aggregates and bounds the history window", async () => {
    jest.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const db = { query: jest.fn().mockResolvedValue({ values: [{
      date: "2026-08-20", exercise_name: "Goblet Squat", tracking_type: "strength",
      max_load_kg: 24, total_volume_kg: 960, total_reps: 40, duration_seconds: 0, distance_meters: 0,
    }] }) };
    jest.mocked(getDb).mockResolvedValue(db as never);
    await expect(getExerciseProgress(90)).resolves.toEqual([expect.objectContaining({ max_load_kg: 24, total_volume_kg: 960 })]);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("sets.completed=1"), ["-90 days"]);
  });
});
