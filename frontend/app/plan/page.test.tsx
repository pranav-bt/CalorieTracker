import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  addBodyMeasurement,
  calculateAndSaveNutritionPlan,
  getBodyMeasurements,
  getCalculatorDraft,
  getLatestRecalibrationReport,
  getNutritionPlans,
  getUserProfile,
  saveCalculatorDraft,
} from "../db/plans";
import PlanPage from "./page";
import type { BodyMeasurement, UserProfile } from "../types";

jest.mock("../db/plans", () => ({
  addBodyMeasurement: jest.fn(), calculateAndSaveNutritionPlan: jest.fn(), discardNutritionPlan: jest.fn(),
  getBodyMeasurements: jest.fn(), getCalculatorDraft: jest.fn(), getLatestRecalibrationReport: jest.fn(),
  getNutritionPlans: jest.fn(), getUserProfile: jest.fn(), restoreNutritionPlan: jest.fn(),
  saveCalculatorDraft: jest.fn(), unarchiveNutritionPlan: jest.fn(),
}));

const profile: UserProfile = {
  birth_date: "1990-01-01", metabolic_sex: "female", height_cm: 165, activity_level: "moderate",
  primary_goal: "maintain", physique_goal: "maintain", current_state: "both_unsure", target_weight_kg: null,
  target_date: null, event_name: "", event_date: null, workout_days_per_week: 3,
  preferred_workout_days: [0, 2, 4], workout_session_minutes: 45, workout_style: "balanced", flex_days_per_week: 1,
  flex_day_weekday: 5, flex_day_calorie_target: 2600, dietary_preferences: [], available_equipment: [],
  injuries_or_limitations: [],
};
const measurements: BodyMeasurement[] = [
  { id: 2, recorded_at: "2026-08-15", weight_kg: 68, body_fat_percent: 24, waist_cm: 76, chest_cm: null, hips_cm: null, arm_cm: null, thigh_cm: null, notes: "" },
  { id: 1, recorded_at: "2026-08-01", weight_kg: 69, body_fat_percent: 25, waist_cm: 78, chest_cm: null, hips_cm: null, arm_cm: null, thigh_cm: null, notes: "" },
];

describe("PlanPage", () => {
  beforeEach(() => {
    jest.mocked(getUserProfile).mockResolvedValue(profile);
    jest.mocked(getBodyMeasurements).mockResolvedValue(measurements);
    jest.mocked(getNutritionPlans).mockResolvedValue([]);
    jest.mocked(getLatestRecalibrationReport).mockResolvedValue(null);
    jest.mocked(getCalculatorDraft).mockResolvedValue(null);
    jest.mocked(saveCalculatorDraft).mockResolvedValue();
    jest.mocked(addBodyMeasurement).mockResolvedValue(3);
  });

  it("restores the reusable calculator fields, configurable flex target, and body history", async () => {
    render(<PlanPage />);
    await waitFor(() => expect(screen.getByLabelText("Date of birth")).toHaveValue("1990-01-01"));
    expect(screen.getByLabelText(/include one flex day/i)).toBeChecked();
    expect(screen.getByLabelText(/Flex-day calories/)).toHaveValue(2600);
    expect(screen.getByLabelText("Workout style")).toHaveValue("balanced");
    expect(screen.getByRole("img", { name: /body weight/i })).toBeInTheDocument();
    expect(getBodyMeasurements).toHaveBeenCalledWith(60);
  });

  it("passes a changed flex target into plan generation", async () => {
    const user = userEvent.setup();
    jest.mocked(calculateAndSaveNutritionPlan).mockResolvedValue({
      id: 7, created_at: "2026-08-24", activated_at: "2026-08-24", is_active: true, source: "initial",
      calculation_method: "mifflin_st_jeor", calories: 2000, weekly_calories: 14000,
      protein_g: 120, carbs_g: 220, fat_g: 60, fiber_g: 28, explanation: "Test", days: [],
    });
    render(<PlanPage />);
    const target = await screen.findByLabelText(/Flex-day calories/);
    await user.clear(target);
    await user.type(target, "2800");
    await user.selectOptions(screen.getByLabelText("Workout style"), "hybrid");
    await user.click(screen.getByRole("button", { name: "Create plan" }));
    await waitFor(() => expect(calculateAndSaveNutritionPlan).toHaveBeenCalledWith(
      expect.objectContaining({ flex_day_calorie_target: 2800, workout_style: "hybrid" }), 68, "initial"
    ));
  });
});
