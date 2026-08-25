import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BodyProgressCharts } from "./BodyProgressCharts";
import { ProgressChart } from "./ProgressChart";
import type { BodyMeasurement } from "../types";

describe("ProgressChart", () => {
  it("renders an accessible trend, latest value, change, and raw data", async () => {
    const user = userEvent.setup();
    render(<ProgressChart title="Body weight" unit="kg" points={[{ label: "2026-08-01", value: 80 }, { label: "2026-08-15", value: 78.5 }]} />);
    expect(screen.getByRole("img", { name: /body weight/i })).toBeInTheDocument();
    expect(screen.getByText("78.5", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("-1.5 kg")).toBeInTheDocument();
    await user.click(screen.getByText("View chart data"));
    expect(screen.getByRole("table")).toHaveTextContent("2026-08-15");
  });

  it("requires two entries instead of drawing a misleading trend", () => {
    render(<ProgressChart title="Waist" unit="cm" points={[{ label: "2026-08-01", value: 90 }]} />);
    expect(screen.getByText(/at least two entries/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("BodyProgressCharts", () => {
  const measurements: BodyMeasurement[] = [
    { id: 2, recorded_at: "2026-08-15", weight_kg: 78.5, body_fat_percent: null, waist_cm: 88, chest_cm: null, hips_cm: null, arm_cm: null, thigh_cm: null, notes: "" },
    { id: 1, recorded_at: "2026-08-01", weight_kg: 80, body_fat_percent: null, waist_cm: 90, chest_cm: null, hips_cm: null, arm_cm: null, thigh_cm: null, notes: "" },
  ];

  it("switches between body metrics and ignores missing values", async () => {
    const user = userEvent.setup();
    render(<BodyProgressCharts measurements={measurements} />);
    expect(screen.getByRole("img", { name: /body weight/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Body progress measurement"), "waist_cm");
    expect(screen.getByRole("img", { name: /waist/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Body progress measurement"), "body_fat_percent");
    expect(screen.getByText(/at least two entries/i)).toBeInTheDocument();
  });
});
