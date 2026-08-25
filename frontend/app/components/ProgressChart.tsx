"use client";

import { useId } from "react";

export type ChartPoint = { label: string; value: number };

export function ProgressChart({ points, title, unit }: { points: ChartPoint[]; title: string; unit: string }) {
  const id = useId();
  if (points.length < 2) {
    return <p className="muted">Log at least two entries to see {title.toLowerCase()}.</p>;
  }

  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 22, bottom: 38, left: 52 };
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.1, 1);
  const min = rawMin - spread * 0.12;
  const max = rawMax + spread * 0.12;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (index / (points.length - 1)) * plotWidth,
    y: padding.top + ((max - point.value) / (max - min)) * plotHeight,
  }));
  const change = points.at(-1)!.value - points[0].value;

  return (
    <div className="progressChart">
      <div className="chartSummary">
        <span><strong>{format(points.at(-1)!.value)}</strong> {unit} latest</span>
        <span>{change === 0 ? "No net change" : `${change > 0 ? "+" : ""}${format(change)} ${unit}`}</span>
      </div>
      <svg aria-labelledby={`${id}-title ${id}-description`} role="img" viewBox={`0 0 ${width} ${height}`}>
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-description`}>{points.length} entries from {points[0].label} to {points.at(-1)!.label}. Latest value {format(points.at(-1)!.value)} {unit}.</desc>
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + ratio * plotHeight;
          const value = max - ratio * (max - min);
          return <g key={ratio}><line className="chartGridLine" x1={padding.left} x2={width - padding.right} y1={y} y2={y} /><text className="chartAxisText" x={padding.left - 8} y={y + 4}>{format(value)}</text></g>;
        })}
        <polyline className="chartLine" fill="none" points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} />
        {coordinates.map((point) => <circle className="chartPoint" cx={point.x} cy={point.y} key={`${point.label}-${point.x}`} r="4"><title>{point.label}: {format(point.value)} {unit}</title></circle>)}
        <text className="chartDateLabel" x={padding.left} y={height - 10}>{shortDate(points[0].label)}</text>
        <text className="chartDateLabel chartDateLabelEnd" x={width - padding.right} y={height - 10}>{shortDate(points.at(-1)!.label)}</text>
      </svg>
      <details className="chartDataDetails">
        <summary>View chart data</summary>
        <table><thead><tr><th>Date</th><th>{title}</th></tr></thead><tbody>{points.map((point, index) => <tr key={`${point.label}-${index}`}><td>{point.label}</td><td>{format(point.value)} {unit}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}

function format(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function shortDate(value: string): string {
  const parts = value.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value;
}
