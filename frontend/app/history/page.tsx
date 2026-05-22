"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Save, Settings, Trash2 } from "lucide-react";
import { API_BASE_URL } from "../config";
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
    const response = await fetch(`${API_BASE_URL}/history`);
    if (!response.ok) throw new Error("Could not load history.");
    setHistory(await response.json());
  }

  async function loadSettings() {
    const response = await fetch(`${API_BASE_URL}/settings`);
    if (!response.ok) throw new Error("Could not load settings.");
    const data = (await response.json()) as AppSettings;
    setSettings(data);
    setRetentionInput(String(data.history_retention_days));
  }

  useEffect(() => {
    Promise.all([loadHistory(), loadSettings()]).catch(() =>
      setError("Backend is not reachable."),
    );
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter((day) => {
      if (fromDate && day.date < fromDate) return false;
      if (toDate && day.date > toDate) return false;
      return true;
    });
  }, [history, fromDate, toDate]);

  async function toggleDay(day: string) {
    if (expandedDay === day) {
      setExpandedDay(null);
      return;
    }
    setExpandedDay(day);
    if (!dayMeals[day]) {
      const response = await fetch(`${API_BASE_URL}/meals?date_filter=${day}`);
      if (response.ok) {
        const meals = (await response.json()) as MealRecord[];
        setDayMeals((prev) => ({ ...prev, [day]: meals }));
      }
    }
  }

  async function deleteMeal(mealId: number, day: string) {
    setError("");
    const response = await fetch(`${API_BASE_URL}/meal/${mealId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Could not delete meal.");
      return;
    }
    setDayMeals((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).filter((m) => m.id !== mealId),
    }));
    await loadHistory();
  }

  async function deleteDay(day: string) {
    setError("");
    const response = await fetch(`${API_BASE_URL}/history/${day}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Could not delete day.");
      return;
    }
    if (expandedDay === day) setExpandedDay(null);
    setDayMeals((prev) => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
    await loadHistory();
  }

  async function saveRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRetentionError("");
    setRetentionMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history_retention_days: Number(retentionInput) }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Could not save.");
      }
      await loadSettings();
      setRetentionMessage("Saved");
    } catch (caught) {
      setRetentionError(caught instanceof Error ? caught.message : "Could not save.");
    }
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
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="dateField">
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          {(fromDate || toDate) && (
            <button
              className="clearBtn"
              type="button"
              onClick={() => { setFromDate(""); setToDate(""); }}
            >
              Clear
            </button>
          )}
        </div>
        {error ? <p className="error">{error}</p> : null}
        {filteredHistory.length ? (
          <ul className="historyList">
            {filteredHistory.map((day) => (
              <li key={day.date} className="historyDayItem">
                <div className="historyDayRow">
                  <button
                    className="historyDayToggle"
                    type="button"
                    onClick={() => toggleDay(day.date)}
                  >
                    <span>{day.date}</span>
                    <strong>{day.total_calories}</strong>
                    {expandedDay === day.date ? (
                      <ChevronUp size={15} />
                    ) : (
                      <ChevronDown size={15} />
                    )}
                  </button>
                  <button
                    className="iconButton danger"
                    title="Delete all meals for this day"
                    type="button"
                    onClick={() => deleteDay(day.date)}
                  >
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
                                {meal.items.map((item) => (
                                  <li key={`${item.name}-${item.quantity}-${item.unit}`}>
                                    <span>
                                      {item.quantity} {item.unit} {item.name}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <button
                              className="iconButton danger"
                              title="Delete meal"
                              type="button"
                              onClick={() => deleteMeal(meal.id, day.date)}
                            >
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
          <input
            min="0"
            step="1"
            type="number"
            value={retentionInput}
            onChange={(e) => setRetentionInput(e.target.value)}
          />
        </label>
        <p className="muted retentionHint">
          {retentionInput === "0" || retentionInput === ""
            ? "Records are kept forever."
            : `Records older than ${retentionInput} day${Number(retentionInput) === 1 ? "" : "s"} are deleted on startup.`}
        </p>
        <button type="submit">
          <Save size={18} />
          Save
        </button>
        {retentionMessage ? <p className="success">{retentionMessage}</p> : null}
        {retentionError ? <p className="error">{retentionError}</p> : null}
      </form>
    </section>
  );
}
