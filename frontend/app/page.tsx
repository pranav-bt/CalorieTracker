"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Circle, Flame, Heart, Trophy } from "lucide-react";
import { API_BASE_URL } from "./config";
import type { DailySummary, HistoryDay } from "./types";

export default function Home() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [error, setError] = useState("");
  const [challengeDone, setChallengeDone] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const [summaryResponse, historyResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/daily-summary`),
        fetch(`${API_BASE_URL}/history`),
      ]);

      if (!summaryResponse.ok || !historyResponse.ok) {
        throw new Error("Could not load dashboard.");
      }

      const summaryData = (await summaryResponse.json()) as DailySummary;
      setSummary(summaryData);
      setChallengeDone(summaryData.challenge_completed);
      setHistory(await historyResponse.json());
    }

    loadDashboard().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Backend is not reachable.");
    });
  }, []);

  async function completeChallenge() {
    setChallengeDone(true);
    await fetch(`${API_BASE_URL}/challenge/complete`, { method: "POST" });
  }

  const goal = summary?.adjusted_goal ?? 0;
  const consumed = summary?.consumed ?? 0;
  const percent = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
  const weekDays = buildWeekDays(summary, history);

  return (
    <section className="pageStack">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>
            {summary?.partner_name ? summary.partner_name : "Home"}
          </h1>
        </div>
        <div className="pageHeaderRight">
          {summary && summary.streak > 0 && (
            <div className="streakBadge">
              <Flame size={15} />
              {summary.streak} day{summary.streak === 1 ? "" : "s"}
            </div>
          )}
          {summary && summary.heart_points > 0 && (
            <Link className="heartBadge" href="/heart-points">
              <Heart size={15} />
              {summary.heart_points} pts
            </Link>
          )}
          <Link className="textButton" href="/log-meal">
            Log meal
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {summary?.greeting && (
        <div className="greetingCard">
          <p>{summary.greeting}</p>
        </div>
      )}

      <div className="summaryBand">
        <div>
          <span className="metricLabel">Consumed</span>
          <strong>{summary?.consumed ?? 0}</strong>
        </div>
        <div>
          <span className="metricLabel">Remaining</span>
          <strong>{summary?.remaining ?? 0}</strong>
        </div>
        <div>
          <span className="metricLabel">Today target</span>
          <strong>{summary?.adjusted_goal ?? 0}</strong>
        </div>
      </div>

      <div className="progressTrack" aria-label={`${percent}% of target used`}>
        <span style={{ width: `${percent}%` }} />
      </div>

      {summary?.affirmation && (
        <div className="affirmationCard">
          <p>&ldquo;{summary.affirmation}&rdquo;</p>
        </div>
      )}

      {summary?.end_of_day_note && (
        <div className="endOfDayCard">
          <p>{summary.end_of_day_note}</p>
        </div>
      )}

      <section className="panel">
        <div className="panelHeader">
          <h2>This week</h2>
          <CalendarDays size={18} />
        </div>
        <div className="weekMetrics">
          <div>
            <span className="metricLabel">Week consumed</span>
            <strong>{summary?.week_consumed ?? 0}</strong>
          </div>
          <div>
            <span className="metricLabel">Week remaining</span>
            <strong>{summary?.week_remaining ?? 0}</strong>
          </div>
          <div>
            <span className="metricLabel">Weekly goal</span>
            <strong>{summary?.weekly_goal ?? 0}</strong>
          </div>
        </div>
        <div className="barChart" aria-label="Current week calories">
          {weekDays.map((day) => {
            const height = summary?.daily_goal
              ? Math.min(100, Math.round((day.total / summary.daily_goal) * 100))
              : 0;
            return (
              <div className="barItem" key={day.date}>
                <div className="barTrack">
                  <span style={{ height: `${height}%` }} />
                </div>
                <small>{day.label}</small>
              </div>
            );
          })}
        </div>
      </section>
      {summary?.weekly_report_message && (
        <section className="panel weekReportCard">
          <div className="panelHeader">
            <h2>This week so far</h2>
            <Trophy size={18} />
          </div>
          <div className="weekReportStats">
            <div>
              <span className="metricLabel">Days logged</span>
              <strong>{summary.days_logged_this_week} / 7</strong>
            </div>
            <div>
              <span className="metricLabel">Consumed</span>
              <strong>{summary.week_consumed}</strong>
            </div>
            <div>
              <span className="metricLabel">Goal</span>
              <strong>{summary.weekly_goal}</strong>
            </div>
          </div>
          <p className="weekReportMessage">{summary.weekly_report_message}</p>
        </section>
      )}

      {summary?.current_challenge && (
        <section className="panel challengePanel">
          <div className="panelHeader">
            <h2>This week&apos;s challenge</h2>
            <button
              className={`challengeToggle ${challengeDone ? "done" : ""}`}
              onClick={challengeDone ? undefined : completeChallenge}
              title={challengeDone ? "Completed!" : "Mark as done"}
              type="button"
            >
              {challengeDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
            </button>
          </div>
          <p className={`challengeText ${challengeDone ? "challengeDone" : ""}`}>
            {summary.current_challenge}
          </p>
          {challengeDone && <p className="challengeCompletedNote">Challenge completed! Amazing work!</p>}
        </section>
      )}
    </section>
  );
}

function buildWeekDays(summary: DailySummary | null, history: HistoryDay[]) {
  if (!summary) return [];

  const totals = new Map(history.map((day) => [day.date, day.total_calories]));
  const start = new Date(`${summary.week_start}T00:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const date = day.toISOString().slice(0, 10);
    return {
      date,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      total: totals.get(date) ?? 0,
    };
  });
}
