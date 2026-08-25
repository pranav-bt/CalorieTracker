import { Capacitor } from "@capacitor/core";
import { getDb } from "./client";
import { getUserProfile, saveUserProfile } from "./plans";
import type { UserProfile } from "../types";

jest.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: jest.fn() } }));
jest.mock("./client", () => ({ getDb: jest.fn(), inTransaction: jest.fn() }));

const mockedNative = jest.mocked(Capacitor.isNativePlatform);
const mockedGetDb = jest.mocked(getDb);

const profile: UserProfile = {
  birth_date: "1990-01-01", metabolic_sex: "female", height_cm: 165, activity_level: "moderate",
  primary_goal: "maintain", physique_goal: "maintain", current_state: "both_unsure", target_weight_kg: null,
  target_date: null, event_name: "", event_date: null, workout_days_per_week: 3,
  preferred_workout_days: [0, 2, 4], workout_session_minutes: 45, workout_style: "balanced", flex_days_per_week: 1,
  flex_day_weekday: 5, flex_day_calorie_target: 2600, dietary_preferences: ["vegetarian"],
  available_equipment: ["dumbbells"], injuries_or_limitations: [],
};

describe("profile persistence", () => {
  beforeEach(() => mockedNative.mockReturnValue(true));

  it("restores arrays and the configured flex-day target", async () => {
    const db = { query: jest.fn().mockResolvedValue({ values: [{
      ...profile,
      preferred_workout_days_json: "[0,2,4]",
      dietary_preferences_json: '["vegetarian"]',
      available_equipment_json: '["dumbbells"]',
      limitations_json: "[]",
    }] }) };
    mockedGetDb.mockResolvedValue(db as never);
    await expect(getUserProfile()).resolves.toEqual(profile);
  });

  it("writes the flex target alongside the rest of the reusable calculator profile", async () => {
    const db = { run: jest.fn().mockResolvedValue({ changes: { changes: 1 } }) };
    mockedGetDb.mockResolvedValue(db as never);
    await saveUserProfile(profile);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining("workout_style=?"), expect.arrayContaining(["balanced", 2600]), true);
  });

  it("refuses profile storage outside Android", async () => {
    mockedNative.mockReturnValue(false);
    await expect(getUserProfile()).rejects.toThrow("Android app");
  });
});
