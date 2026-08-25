import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseProgressCharts } from "./ExerciseProgressCharts";
import type { ExerciseProgressPoint } from "../types";

const progress: ExerciseProgressPoint[] = [
  { date: "2026-08-01", exercise_name: "Goblet Squat", tracking_type: "strength", max_load_kg: 20, total_volume_kg: 800, total_reps: 40, duration_seconds: 0, distance_meters: 0 },
  { date: "2026-08-15", exercise_name: "Goblet Squat", tracking_type: "strength", max_load_kg: 24, total_volume_kg: 960, total_reps: 40, duration_seconds: 0, distance_meters: 0 },
  { date: "2026-08-01", exercise_name: "Run", tracking_type: "cardio", max_load_kg: null, total_volume_kg: 0, total_reps: 0, duration_seconds: 1800, distance_meters: 5000 },
  { date: "2026-08-15", exercise_name: "Run", tracking_type: "cardio", max_load_kg: null, total_volume_kg: 0, total_reps: 0, duration_seconds: 1920, distance_meters: 5500 },
];

describe("ExerciseProgressCharts", () => {
  it("shows strength metrics and lets the user switch exercise and metric", async () => {
    const user = userEvent.setup();
    render(<ExerciseProgressCharts progress={progress} />);
    expect(screen.getByRole("img", { name: /goblet squat.*heaviest completed load/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Exercise progress metric"), "total_volume_kg");
    expect(screen.getByRole("img", { name: /completed training volume/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Progress exercise"), "Run");
    expect(await screen.findByRole("img", { name: /run.*completed duration/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Exercise progress metric"), "distance_km");
    expect(screen.getByText("+0.5 km")).toBeInTheDocument();
  });

  it("explains the empty state", () => {
    render(<ExerciseProgressCharts progress={[]} />);
    expect(screen.getByText(/complete a workout/i)).toBeInTheDocument();
  });
});
