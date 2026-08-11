"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, Circle, Flame, Trophy } from "lucide-react";
import { getDailyMacroSummary, getDailySummary, getHistory, completeChallenge as dbCompleteChallenge } from "./db";
import type { DailyMacroSummary, DailySummary, HistoryDay } from "./types";
import { QuickMealLogger } from "./components/QuickMealLogger";

const EMPTY_MACROS: DailyMacroSummary = {
  consumed: { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  target: { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  plan_id: null,
};

export default function Home() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [macros, setMacros] = useState<DailyMacroSummary>(EMPTY_MACROS);
  const [error, setError] = useState("");
  const [challengeDone, setChallengeDone] = useState(false);

  async function loadDashboard() {
    const [summaryData, historyData, macroData] = await Promise.all([
      getDailySummary(),
      getHistory(),
      getDailyMacroSummary(),
    ]);
    setSummary(summaryData);
    setChallengeDone(summaryData.challenge_completed);
    setHistory(historyData);
    setMacros(macroData);
  }

  useEffect(() => {
    loadDashboard().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Backend is not reachable.");
    });
  }, []);

  async function completeChallenge() {
    setChallengeDone(true);
    await dbCompleteChallenge();
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

      <QuickMealLogger onLogged={loadDashboard} />

      <section className="panel">
        <div className="panelHeader">
          <h2>Today&apos;s macros</h2>
          <Activity size={18} />
        </div>
        <div className="macroGrid">
          <MacroMetric label="Protein" consumed={macros.consumed.protein_g} target={macros.target.protein_g} />
          <MacroMetric label="Carbs" consumed={macros.consumed.carbs_g} target={macros.target.carbs_g} />
          <MacroMetric label="Fat" consumed={macros.consumed.fat_g} target={macros.target.fat_g} />
          <MacroMetric label="Fiber" consumed={macros.consumed.fiber_g} target={macros.target.fiber_g} />
        </div>
        {!macros.plan_id && (
          <p className="muted compactText">Macro targets will appear after the first plan is calculated.</p>
        )}
      </section>

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

function MacroMetric({ label, consumed, target }: { label: string; consumed: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <div className="macroMetric">
      <div>
        <span className="metricLabel">{label}</span>
        <strong>{consumed}g</strong>
        <small>{target > 0 ? `of ${target}g` : "No target"}</small>
      </div>
      <div className="macroTrack" aria-label={`${label}: ${consumed} of ${target} grams`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
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
