"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Save, Settings } from "lucide-react";
import { getDailySummary, updateSettings } from "../db";
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
    getDailySummary()
      .then((s) => {
        setSummary(s);
        setGoalMode(s.goal_mode);
        setDailyGoal(String(s.daily_goal));
        setWeeklyGoal(String(s.weekly_goal));
        setWeekStartDay(s.week_start_day);
        setPartnerName(s.partner_name ?? "");
      })
      .catch(() => setError("Could not load goals."));
  }, []);

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    try {
      const s = await updateSettings({
        goal_mode: goalMode,
        daily_calorie_goal: goalMode === "daily" ? Number(dailyGoal) : undefined,
        weekly_calorie_goal: goalMode === "weekly" ? Number(weeklyGoal) : undefined,
      });
      setSummary(s);
      setDailyGoal(String(s.daily_goal));
      setWeeklyGoal(String(s.weekly_goal));
      setMessage("Saved goal");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save goal."); }
  }

  async function submitPartnerName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(""); setNameMessage("");
    try {
      await updateSettings({ partner_name: partnerName.trim() });
      setNameMessage("Saved");
    } catch (e) { setNameError(e instanceof Error ? e.message : "Could not save."); }
  }

  async function submitWeekStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWeekError(""); setWeekMessage("");
    try {
      const s = await updateSettings({ week_start_day: weekStartDay });
      setSummary(s);
      setWeekMessage("Saved");
    } catch (e) { setWeekError(e instanceof Error ? e.message : "Could not save."); }
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
          <input placeholder="e.g. Priya" type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
        </label>
        <button type="submit"><Save size={18} />Save</button>
        {nameMessage && <p className="success">{nameMessage}</p>}
        {nameError && <p className="error">{nameError}</p>}
      </form>

      <form className="panel settingsForm" onSubmit={submitSettings}>
        <div className="panelHeader">
          <h2>Calorie goal</h2>
          <Settings size={18} />
        </div>
        <div className="toggleGroup">
          <label>
            <input checked={goalMode === "daily"} name="goalMode" onChange={() => setGoalMode("daily")} type="radio" />
            Daily
          </label>
          <label>
            <input checked={goalMode === "weekly"} name="goalMode" onChange={() => setGoalMode("weekly")} type="radio" />
            Weekly
          </label>
        </div>
        <label className="stackedField">
          <span>{goalMode === "daily" ? "Daily calories" : "Weekly calories"}</span>
          <input
            min="1" step="1" type="number"
            value={goalMode === "daily" ? dailyGoal : weeklyGoal}
            onChange={(e) => goalMode === "daily" ? setDailyGoal(e.target.value) : setWeeklyGoal(e.target.value)}
          />
        </label>
        <button type="submit"><Save size={18} />Save goal</button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <form className="panel settingsForm" onSubmit={submitWeekStart}>
        <div className="panelHeader">
          <h2>Week start day</h2>
          <CalendarDays size={18} />
        </div>
        <label className="stackedField">
          <span>First day of the week</span>
          <select value={weekStartDay} onChange={(e) => setWeekStartDay(Number(e.target.value))}>
            {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
        </label>
        <button type="submit"><Save size={18} />Save</button>
        {weekMessage && <p className="success">{weekMessage}</p>}
        {weekError && <p className="error">{weekError}</p>}
      </form>

      {summary && (
        <section className="panel">
          <div className="summaryBand compact">
            <div><span className="metricLabel">Daily baseline</span><strong>{summary.daily_goal}</strong></div>
            <div><span className="metricLabel">Weekly goal</span><strong>{summary.weekly_goal}</strong></div>
            <div><span className="metricLabel">Today target</span><strong>{summary.adjusted_goal}</strong></div>
          </div>
          <div className="goalDetails">
            <span>Week {summary.week_start} to {summary.week_end}</span>
            <strong>{summary.week_remaining} left this week</strong>
          </div>
        </section>
      )}
    </section>
  );
}
