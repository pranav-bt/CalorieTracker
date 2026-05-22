"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Save, Settings } from "lucide-react";
import { API_BASE_URL } from "../config";
import type { DailySummary, GoalMode } from "../types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function GoalsPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [goalMode, setGoalMode] = useState<GoalMode>("daily");
  const [dailyGoal, setDailyGoal] = useState("2000");
  const [weeklyGoal, setWeeklyGoal] = useState("14000");
  const [weekStartDay, setWeekStartDay] = useState(0);
  const [weekMessage, setWeekMessage] = useState("");
  const [weekError, setWeekError] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [nameMessage, setNameMessage] = useState("");
  const [nameError, setNameError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSummary() {
      const response = await fetch(`${API_BASE_URL}/daily-summary`);
      if (!response.ok) throw new Error("Could not load goals.");
      const nextSummary = (await response.json()) as DailySummary;
      setSummary(nextSummary);
      setGoalMode(nextSummary.goal_mode);
      setDailyGoal(String(nextSummary.daily_goal));
      setWeeklyGoal(String(nextSummary.weekly_goal));
      setWeekStartDay(nextSummary.week_start_day);
      setPartnerName(nextSummary.partner_name ?? "");
    }

    loadSummary().catch(() => setError("Backend is not reachable."));
  }, []);

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_mode: goalMode,
          daily_calorie_goal: goalMode === "daily" ? Number(dailyGoal) : undefined,
          weekly_calorie_goal: goalMode === "weekly" ? Number(weeklyGoal) : undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Could not save goal.");
      }

      const nextSummary = (await response.json()) as DailySummary;
      setSummary(nextSummary);
      setDailyGoal(String(nextSummary.daily_goal));
      setWeeklyGoal(String(nextSummary.weekly_goal));
      setMessage("Saved goal");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save goal.");
    }
  }

  async function submitPartnerName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError("");
    setNameMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_name: partnerName.trim() }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Could not save.");
      }
      setNameMessage("Saved");
    } catch (caught) {
      setNameError(caught instanceof Error ? caught.message : "Could not save.");
    }
  }

  async function submitWeekStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWeekError("");
    setWeekMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start_day: weekStartDay }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Could not save.");
      }
      const nextSummary = (await response.json()) as DailySummary;
      setSummary(nextSummary);
      setWeekMessage("Saved");
    } catch (caught) {
      setWeekError(caught instanceof Error ? caught.message : "Could not save.");
    }
  }

  return (
    <section className="pageStack">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Goals</h1>
        </div>
      </div>

      <form className="panel settingsForm" onSubmit={submitPartnerName}>
        <div className="panelHeader">
          <h2>Her name</h2>
          <Save size={18} />
        </div>
        <label className="stackedField">
          <span>Partner&apos;s name (shown on dashboard)</span>
          <input
            placeholder="e.g. Priya"
            type="text"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
          />
        </label>
        <button type="submit">
          <Save size={18} />
          Save
        </button>
        {nameMessage ? <p className="success">{nameMessage}</p> : null}
        {nameError ? <p className="error">{nameError}</p> : null}
      </form>

      <form className="panel settingsForm" onSubmit={submitSettings}>
        <div className="panelHeader">
          <h2>Calorie goal</h2>
          <Settings size={18} />
        </div>
        <div className="toggleGroup">
          <label>
            <input
              checked={goalMode === "daily"}
              name="goalMode"
              onChange={() => setGoalMode("daily")}
              type="radio"
            />
            Daily
          </label>
          <label>
            <input
              checked={goalMode === "weekly"}
              name="goalMode"
              onChange={() => setGoalMode("weekly")}
              type="radio"
            />
            Weekly
          </label>
        </div>
        <label className="stackedField">
          <span>{goalMode === "daily" ? "Daily calories" : "Weekly calories"}</span>
          <input
            min="1"
            step="1"
            type="number"
            value={goalMode === "daily" ? dailyGoal : weeklyGoal}
            onChange={(event) =>
              goalMode === "daily"
                ? setDailyGoal(event.target.value)
                : setWeeklyGoal(event.target.value)
            }
          />
        </label>
        <button type="submit">
          <Save size={18} />
          Save goal
        </button>
        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>

      <form className="panel settingsForm" onSubmit={submitWeekStart}>
        <div className="panelHeader">
          <h2>Week start day</h2>
          <CalendarDays size={18} />
        </div>
        <label className="stackedField">
          <span>First day of the week</span>
          <select
            value={weekStartDay}
            onChange={(event) => setWeekStartDay(Number(event.target.value))}
          >
            {DAY_NAMES.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">
          <Save size={18} />
          Save
        </button>
        {weekMessage ? <p className="success">{weekMessage}</p> : null}
        {weekError ? <p className="error">{weekError}</p> : null}
      </form>

      {summary ? (
        <section className="panel">
          <div className="summaryBand compact">
            <div>
              <span className="metricLabel">Daily baseline</span>
              <strong>{summary.daily_goal}</strong>
            </div>
            <div>
              <span className="metricLabel">Weekly goal</span>
              <strong>{summary.weekly_goal}</strong>
            </div>
            <div>
              <span className="metricLabel">Today target</span>
              <strong>{summary.adjusted_goal}</strong>
            </div>
          </div>
          <div className="goalDetails">
            <span>Week {summary.week_start} to {summary.week_end}</span>
            <strong>{summary.week_remaining} left this week</strong>
          </div>
        </section>
      ) : null}
    </section>
  );
}

