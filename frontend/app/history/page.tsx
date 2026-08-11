"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Download, RotateCcw, Save, Settings, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { deleteHistoryDay, deleteMeal, getHistory, getMeals, getSettings, updateSettings } from "../db";
import { hasSafetyBackup, restoreDatabaseBackup, restoreSafetyBackup, shareDatabaseBackup } from "../db/backup";
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
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");
  const [safetyBackupAvailable, setSafetyBackupAvailable] = useState(false);
  const [isNative, setIsNative] = useState(false);

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
    if (Capacitor.isNativePlatform()) {
      setIsNative(true);
      hasSafetyBackup().then(setSafetyBackupAvailable).catch(() => undefined);
    }
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

  async function exportBackup() {
    setBackupBusy(true); setBackupError(""); setBackupMessage("");
    try {
      await shareDatabaseBackup();
      setBackupMessage("Backup prepared. Choose where to save it in the Android share sheet.");
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : "Could not create backup.");
    } finally { setBackupBusy(false); }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    if (!window.confirm("Replace all current app data with this backup? A local safety copy will be created first.")) return;
    setBackupBusy(true); setBackupError(""); setBackupMessage("");
    try {
      await restoreDatabaseBackup(await file.text());
      setBackupMessage("Restore complete. Reloading the app…");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : "Could not restore backup.");
      setSafetyBackupAvailable(await hasSafetyBackup());
      setBackupBusy(false);
    }
  }

  async function restorePreviousState() {
    if (!window.confirm("Replace current data with the last automatic pre-import safety copy?")) return;
    setBackupBusy(true); setBackupError(""); setBackupMessage("");
    try {
      await restoreSafetyBackup();
      setBackupMessage("Previous state restored. Reloading the app…");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : "Could not restore the safety copy.");
      setBackupBusy(false);
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

      {isNative && (
        <section className="panel backupPanel">
          <div className="panelHeader">
            <div>
              <h2>Backup and restore</h2>
              <p className="muted">A backup includes your foods, meals, goals, plans, inventory, workouts, and settings.</p>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="backupActions">
            <button type="button" onClick={exportBackup} disabled={backupBusy}>
              <Download size={18} /> Export backup
            </button>
            <label className={backupBusy ? "fileButton disabled" : "fileButton"}>
              <Upload size={18} /> Import backup
              <input
                accept="application/json,.json"
                disabled={backupBusy}
                onChange={(event) => {
                  void importBackup(event.target.files?.[0]);
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
            {safetyBackupAvailable && (
              <button className="secondaryButton" type="button" onClick={restorePreviousState} disabled={backupBusy}>
                <RotateCcw size={18} /> Undo last import
              </button>
            )}
          </div>
          <p className="muted">Everything stays on this device unless you explicitly export a file.</p>
          {backupBusy && <p className="muted">Working…</p>}
          {backupMessage && <p className="success">{backupMessage}</p>}
          {backupError && <p className="error">{backupError}</p>}
        </section>
      )}
    </section>
  );
}
