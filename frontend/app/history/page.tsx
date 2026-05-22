"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Save, Settings, Trash2 } from "lucide-react";
import { deleteHistoryDay, deleteMeal, getHistory, getMeals, getSettings, updateSettings } from "../db";
import type { HistoryDay, MealRecord, Settings as AppSettings } from "../types";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dayMeals, setDayMeals] = useState<Record<string, MealRecord[]>>({});
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [retentionInput, setRetentionInput] = useState("0");
  const [retentionMessage, setRetentionMessage] = useState("");
  const [retentionError, setRetentionError] = useState("");
  const [error, setError] = useState("");

  async function loadHistory() {
    setHistory(await getHistory());
  }

  async function loadSettings() {
    const s = await getSettings();
    setSettings(s);
    setRetentionInput(String(s.history_retention_days));
  }

  useEffect(() => {
    Promise.all([loadHistory(), loadSettings()]).catch(() => setError("Could not load data."));
  }, []);

  const filteredHistory = useMemo(() => history.filter((d) => {
    if (fromDate && d.date < fromDate) return false;
    if (toDate && d.date > toDate) return false;
    return true;
  }), [history, fromDate, toDate]);

  async function toggleDay(day: string) {
    if (expandedDay === day) { setExpandedDay(null); return; }
    setExpandedDay(day);
    if (!dayMeals[day]) {
      const meals = await getMeals(day);
      setDayMeals((prev) => ({ ...prev, [day]: meals }));
    }
  }

  async function handleDeleteMeal(mealId: number, day: string) {
    setError("");
    try {
      await deleteMeal(mealId);
      setDayMeals((prev) => ({ ...prev, [day]: (prev[day] ?? []).filter((m) => m.id !== mealId) }));
      await loadHistory();
    } catch { setError("Could not delete meal."); }
  }

  async function handleDeleteDay(day: string) {
    setError("");
    try {
      await deleteHistoryDay(day);
      if (expandedDay === day) setExpandedDay(null);
      setDayMeals((prev) => { const n = { ...prev }; delete n[day]; return n; });
      await loadHistory();
    } catch { setError("Could not delete day."); }
  }

  async function saveRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRetentionError(""); setRetentionMessage("");
    try {
      await updateSettings({ history_retention_days: Number(retentionInput) });
      await loadSettings();
      setRetentionMessage("Saved");
    } catch (e) { setRetentionError(e instanceof Error ? e.message : "Could not save."); }
  }

  return (
    <section className="pageStack">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Records</p>
          <h1>History</h1>
        </div>
      </div>

      <section className="panel">
        <div className="panelHeader">
          <h2>Daily totals</h2>
          <CalendarDays size={18} />
        </div>
        <div className="dateRangeRow">
          <label className="dateField">
            <span>From</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="dateField">
            <span>To</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          {(fromDate || toDate) && (
            <button className="clearBtn" type="button" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        {filteredHistory.length ? (
          <ul className="historyList">
            {filteredHistory.map((day) => (
              <li key={day.date} className="historyDayItem">
                <div className="historyDayRow">
                  <button className="historyDayToggle" type="button" onClick={() => toggleDay(day.date)}>
                    <span>{day.date}</span>
                    <strong>{day.total_calories}</strong>
                    {expandedDay === day.date ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button className="iconButton danger" title="Delete all meals for this day" type="button" onClick={() => handleDeleteDay(day.date)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                {expandedDay === day.date && (
                  <div className="dayMealsPanel">
                    {dayMeals[day.date] === undefined ? (
                      <p className="muted">Loading…</p>
                    ) : dayMeals[day.date].length === 0 ? (
                      <p className="muted">No meals.</p>
                    ) : (
                      <ul className="mealList">
                        {dayMeals[day.date].map((meal) => (
                          <li key={meal.id}>
                            <div>
                              <strong>{meal.total_calories} kcal</strong>
                              <ul className="inlineItems">
                                {meal.items.map((item, idx) => (
                                  <li key={idx}>
                                    <span>{item.quantity} {item.unit} {item.name}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <button className="iconButton danger" title="Delete meal" type="button" onClick={() => handleDeleteMeal(meal.id, day.date)}>
                              <Trash2 size={15} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No history found.</p>
        )}
      </section>

      <form className="panel settingsForm" onSubmit={saveRetention}>
        <div className="panelHeader">
          <h2>Data retention</h2>
          <Settings size={18} />
        </div>
        <label className="stackedField">
          <span>Auto-delete records older than (days)</span>
          <input min="0" step="1" type="number" value={retentionInput} onChange={(e) => setRetentionInput(e.target.value)} />
        </label>
        <p className="muted retentionHint">
          {retentionInput === "0" || retentionInput === ""
            ? "Records are kept forever."
            : `Records older than ${retentionInput} day${Number(retentionInput) === 1 ? "" : "s"} are deleted on startup.`}
        </p>
        <button type="submit"><Save size={18} />Save</button>
        {retentionMessage && <p className="success">{retentionMessage}</p>}
        {retentionError && <p className="error">{retentionError}</p>}
      </form>
    </section>
  );
}
