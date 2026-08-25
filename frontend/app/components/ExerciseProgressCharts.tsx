"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { ExerciseProgressPoint } from "../types";
import { ProgressChart } from "./ProgressChart";

type Metric = "max_load_kg" | "total_volume_kg" | "total_reps" | "duration_minutes" | "distance_km";
const METRICS: Record<Metric, { label: string; unit: string }> = {
  max_load_kg: { label: "Heaviest completed load", unit: "kg" },
  total_volume_kg: { label: "Completed training volume", unit: "kg" },
  total_reps: { label: "Completed repetitions", unit: "reps" },
  duration_minutes: { label: "Completed duration", unit: "min" },
  distance_km: { label: "Completed distance", unit: "km" },
};

export function ExerciseProgressCharts({ progress }: { progress: ExerciseProgressPoint[] }) {
  const exerciseNames = useMemo(() => [...new Set(progress.map((point) => point.exercise_name))].sort(), [progress]);
  const [exercise, setExercise] = useState(exerciseNames[0] ?? "");
  const selected = useMemo(() => progress.filter((point) => point.exercise_name === exercise), [progress, exercise]);
  const availableMetrics = useMemo(() => metricOptions(selected), [selected]);
  const [metric, setMetric] = useState<Metric>(availableMetrics[0] ?? "total_reps");

  useEffect(() => {
    if (!exerciseNames.includes(exercise)) setExercise(exerciseNames[0] ?? "");
  }, [exercise, exerciseNames]);
  useEffect(() => {
    if (!availableMetrics.includes(metric)) setMetric(availableMetrics[0] ?? "total_reps");
  }, [availableMetrics, metric]);

  const points = selected.map((point) => ({ label: point.date, value: metricValue(point, metric) }));
  const metadata = METRICS[metric];
  return (
    <section className="panel">
      <div className="panelHeader"><div><h2>Exercise progress</h2><p className="muted">Completed sets from the last 180 days.</p></div><TrendingUp size={18} /></div>
      {exerciseNames.length ? <>
        <div className="chartControls">
          <label className="stackedField"><span>Exercise</span><select aria-label="Progress exercise" value={exercise} onChange={(event) => setExercise(event.target.value)}>{exerciseNames.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="stackedField"><span>Metric</span><select aria-label="Exercise progress metric" value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>{availableMetrics.map((value) => <option key={value} value={value}>{METRICS[value].label}</option>)}</select></label>
        </div>
        <ProgressChart points={points} title={`${exercise}: ${metadata.label}`} unit={metadata.unit} />
      </> : <p className="muted">Complete a workout to begin tracking exercise progress.</p>}
    </section>
  );
}

function metricOptions(points: ExerciseProgressPoint[]): Metric[] {
  if (!points.length) return [];
  const options: Metric[] = [];
  if (points.some((point) => point.max_load_kg !== null)) options.push("max_load_kg", "total_volume_kg");
  if (points.some((point) => point.total_reps > 0)) options.push("total_reps");
  if (points.some((point) => point.duration_seconds > 0)) options.push("duration_minutes");
  if (points.some((point) => point.distance_meters > 0)) options.push("distance_km");
  return options.length ? options : ["total_reps"];
}

function metricValue(point: ExerciseProgressPoint, metric: Metric): number {
  if (metric === "max_load_kg") return point.max_load_kg ?? 0;
  if (metric === "duration_minutes") return Math.round((point.duration_seconds / 60) * 10) / 10;
  if (metric === "distance_km") return Math.round((point.distance_meters / 1000) * 100) / 100;
  return point[metric];
}
