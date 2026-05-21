"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Plus, RefreshCw, Trash2 } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type MealItem = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
};

type MealSummary = {
  id: number;
  date: string;
  items: MealItem[];
  total_calories: number;
  daily_total: number;
  remaining: number;
};

type DailySummary = {
  date: string;
  goal: number;
  consumed: number;
  remaining: number;
};

type HistoryDay = {
  date: string;
  total_calories: number;
};

export default function Home() {
  const [text, setText] = useState("2 eggs and toast");
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [lastMeal, setLastMeal] = useState<MealSummary | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function refreshData() {
    const [summaryResponse, historyResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/daily-summary`),
      fetch(`${API_BASE_URL}/history`),
    ]);

    if (summaryResponse.ok) {
      setSummary(await summaryResponse.json());
    }

    if (historyResponse.ok) {
      setHistory(await historyResponse.json());
    }
  }

  useEffect(() => {
    refreshData().catch(() => {
      setError("Backend is not reachable.");
    });
  }, []);

  async function submitMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/log-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Could not log meal.");
      }

      const meal = (await response.json()) as MealSummary;
      setLastMeal(meal);
      setSummary({
        date: meal.date,
        goal: (summary?.goal ?? 2000),
        consumed: meal.daily_total,
        remaining: meal.remaining,
      });
      await refreshData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log meal.");
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteLastMeal() {
    if (!lastMeal) return;

    setError("");
    const response = await fetch(`${API_BASE_URL}/meal/${lastMeal.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError("Could not delete the last meal.");
      return;
    }

    setLastMeal(null);
    await refreshData();
  }

  const goal = summary?.goal ?? 2000;
  const consumed = summary?.consumed ?? 0;
  const remaining = summary?.remaining ?? goal;
  const percent = Math.min(100, Math.round((consumed / goal) * 100));

  return (
    <main className="shell">
      <section className="workspace">
        <div className="topbar">
          <div>
            <p className="eyebrow">Today</p>
            <h1>Calorie Tracker</h1>
          </div>
          <button className="iconButton" onClick={refreshData} title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="summaryBand">
          <div>
            <span className="metricLabel">Consumed</span>
            <strong>{consumed}</strong>
          </div>
          <div>
            <span className="metricLabel">Remaining</span>
            <strong>{remaining}</strong>
          </div>
          <div>
            <span className="metricLabel">Goal</span>
            <strong>{goal}</strong>
          </div>
        </div>

        <div className="progressTrack" aria-label={`${percent}% of goal used`}>
          <span style={{ width: `${percent}%` }} />
        </div>

        <form className="logForm" onSubmit={submitMeal}>
          <label htmlFor="meal">Meal input</label>
          <div className="inputRow">
            <input
              id="meal"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="2 eggs and toast"
            />
            <button disabled={isLoading} type="submit">
              <Plus size={18} />
              Log
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </form>

        {lastMeal ? (
          <section className="panel">
            <div className="panelHeader">
              <h2>Last meal</h2>
              <button
                className="iconButton danger"
                onClick={deleteLastMeal}
                title="Delete last meal"
              >
                <Trash2 size={17} />
              </button>
            </div>
            <ul className="items">
              {lastMeal.items.map((item) => (
                <li key={`${item.name}-${item.unit}`}>
                  <span>
                    {item.quantity} {item.unit} {item.name}
                  </span>
                  <strong>{item.calories}</strong>
                </li>
              ))}
            </ul>
            <div className="totalLine">
              <span>Total</span>
              <strong>{lastMeal.total_calories}</strong>
            </div>
          </section>
        ) : null}
      </section>

      <aside className="history">
        <div className="panelHeader">
          <h2>History</h2>
          <CalendarDays size={18} />
        </div>
        {history.length ? (
          <ul className="historyList">
            {history.map((day) => (
              <li key={day.date}>
                <span>{day.date}</span>
                <strong>{day.total_calories}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No meals logged yet.</p>
        )}
      </aside>
    </main>
  );
}

