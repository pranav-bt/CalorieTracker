"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { BodyMeasurement } from "../types";
import { ProgressChart } from "./ProgressChart";

const METRICS = {
  weight_kg: { label: "Body weight", unit: "kg" },
  body_fat_percent: { label: "Body fat", unit: "%" },
  waist_cm: { label: "Waist", unit: "cm" },
  chest_cm: { label: "Chest", unit: "cm" },
  hips_cm: { label: "Hips", unit: "cm" },
  arm_cm: { label: "Arm", unit: "cm" },
  thigh_cm: { label: "Thigh", unit: "cm" },
} as const;

type Metric = keyof typeof METRICS;

export function BodyProgressCharts({ measurements }: { measurements: BodyMeasurement[] }) {
  const [metric, setMetric] = useState<Metric>("weight_kg");
  const points = useMemo(() => measurements
    .map((measurement) => ({ label: measurement.recorded_at.slice(0, 10), value: measurement[metric] }))
    .filter((point): point is { label: string; value: number } => typeof point.value === "number")
    .sort((a, b) => a.label.localeCompare(b.label)), [measurements, metric]);
  const metadata = METRICS[metric];

  return (
    <section className="panel">
      <div className="panelHeader"><div><h2>Body progress</h2><p className="muted">Up to your latest 60 check-ins, stored only on this device.</p></div><TrendingUp size={18} /></div>
      <label className="stackedField chartMetricPicker"><span>Measurement</span><select aria-label="Body progress measurement" value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>{Object.entries(METRICS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select></label>
      <ProgressChart points={points} title={metadata.label} unit={metadata.unit} />
    </section>
  );
}
