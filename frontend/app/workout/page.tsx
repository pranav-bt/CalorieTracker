"use client";

import { FormEvent, useEffect, useState } from "react";
import { Activity, Check, Dumbbell, RefreshCw, Save } from "lucide-react";
import { getUserProfile } from "../db/plans";
import {
  generateAndSaveWorkoutPlan,
  getActiveWorkoutPlan,
  getLatestWorkoutRecalibrationReport,
  getRecentWorkoutSessions,
  recalibrateWorkoutPlan,
  saveWorkoutSession,
} from "../db/workouts";
import type {
  UserProfile,
  WorkoutPlan,
  WorkoutPlanDay,
  WorkoutRecalibrationReport,
  WorkoutSessionDraft,
  WorkoutSessionSummary,
} from "../types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type SetForm = { reps: string; load: string; rir: string; rpe: string; duration: string; distance: string; completed: boolean };
type ExerciseForm = { pain: boolean; notes: string; sets: SetForm[] };

export default function WorkoutPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [sessions, setSessions] = useState<WorkoutSessionSummary[]>([]);
  const [report, setReport] = useState<WorkoutRecalibrationReport | null>(null);
  const [loggingDay, setLoggingDay] = useState<WorkoutPlanDay | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [savedProfile, activePlan, recentSessions, latestReport] = await Promise.all([
      getUserProfile(), getActiveWorkoutPlan(), getRecentWorkoutSessions(), getLatestWorkoutRecalibrationReport(),
    ]);
    setProfile(savedProfile); setPlan(activePlan); setSessions(recentSessions); setReport(latestReport); setIsBusy(false);
  }

  useEffect(() => { load().catch((caught) => { setError(caught instanceof Error ? caught.message : "Could not load workouts."); setIsBusy(false); }); }, []);

  async function generate() {
    if (!profile) { setError("Create your profile in Plan first."); return; }
    setIsBusy(true); setError("");
    try { const created = await generateAndSaveWorkoutPlan(profile); setPlan(created); setMessage("Workout plan created."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create workout plan."); }
    finally { setIsBusy(false); }
  }

  async function recalibrate() {
    setIsBusy(true); setError("");
    try { const result = await recalibrateWorkoutPlan(); setReport(result); setMessage("Workout data recalibrated."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not recalibrate workouts."); setIsBusy(false); }
  }

  return (
    <section className="pageStack">
      <div className="pageHeader"><div><p className="eyebrow">Offline training</p><h1>Workout</h1></div><div className="pageHeaderRight"><button disabled={isBusy || !profile} onClick={generate} type="button"><Dumbbell size={17} />{plan ? "Rebuild plan" : "Create plan"}</button></div></div>
      {message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}
      {!profile && <section className="panel"><p>Create a nutrition and training profile in the Plan section before generating workouts.</p></section>}

      {plan && <section className="panel">
        <div className="panelHeader"><div><h2>{plan.name}</h2><p className="muted compactText">{plan.explanation}</p></div><Dumbbell size={18} /></div>
        <div className="workoutWeek">{plan.days.map((day) => <article className="workoutDay" key={day.id}>
          <div className="workoutDayHeader"><div><span>{DAYS[day.weekday]}</span><h3>{day.title}</h3><small>{day.focus} · {day.estimated_minutes} min</small></div><button onClick={() => setLoggingDay(day)} type="button"><Activity size={16} />Log</button></div>
          <ol>{day.exercises.map((exercise) => <li key={exercise.id}><strong>{exercise.exercise_name}</strong><small>{prescriptionText(exercise)}</small>{exercise.target_load_kg ? <span className="targetLoad">Next: {exercise.target_load_kg} kg</span> : null}</li>)}</ol>
        </article>)}</div>
        <button className="secondaryButton recalibrateButton" disabled={isBusy || sessions.length < 2} onClick={recalibrate} type="button"><RefreshCw size={16} />Recalibrate from logs</button>
        {sessions.length < 2 && <p className="fieldHint">Log at least two workouts to unlock recalibration.</p>}
      </section>}

      {loggingDay && <WorkoutLogger day={loggingDay} onCancel={() => setLoggingDay(null)} onSaved={async () => { setLoggingDay(null); setMessage("Workout saved."); await load(); }} />}
      {report && <WorkoutReport report={report} />}
      {sessions.length > 0 && <section className="panel"><div className="panelHeader"><h2>Recent workouts</h2><Check size={18} /></div><ul className="sessionList">{sessions.map((session) => <li key={session.id}><div><strong>{session.title}</strong><small>{session.scheduled_for} · {session.completed_sets} sets</small></div><div className="sessionSignals">{session.energy_rating && <span>Energy {session.energy_rating}/5</span>}{session.recovery_rating && <span>Recovery {session.recovery_rating}/5</span>}{session.pain_reported && <span className="painSignal">Pain noted</span>}</div></li>)}</ul></section>}
    </section>
  );
}

function WorkoutLogger({ day, onCancel, onSaved }: { day: WorkoutPlanDay; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [forms, setForms] = useState<ExerciseForm[]>(() => day.exercises.map((exercise) => ({
    pain: false, notes: "", sets: Array.from({ length: exercise.target_sets ?? 1 }, () => ({ reps: "", load: exercise.target_load_kg ? String(exercise.target_load_kg) : "", rir: "", rpe: "", duration: exercise.target_duration_s ? String(Math.round(exercise.target_duration_s / 60)) : "", distance: "", completed: true })),
  })));
  const [energy, setEnergy] = useState("3"); const [recovery, setRecovery] = useState("3"); const [notes, setNotes] = useState(""); const [pain, setPain] = useState(false); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetForm>) { setForms((current) => current.map((form, fi) => fi !== exerciseIndex ? form : { ...form, sets: form.sets.map((set, si) => si === setIndex ? { ...set, ...patch } : set) })); }
  function updateExercise(index: number, patch: Partial<ExerciseForm>) { setForms((current) => current.map((form, fi) => fi === index ? { ...form, ...patch } : form)); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const draft: WorkoutSessionDraft = {
        plan_day_id: day.id!, scheduled_for: localDate(), energy_rating: Number(energy), recovery_rating: Number(recovery), pain_reported: pain || forms.some((form) => form.pain), notes,
        exercises: day.exercises.map((exercise, index) => ({
          plan_exercise_id: exercise.id ?? null, exercise_name: exercise.exercise_name, tracking_type: exercise.tracking_type, order_index: exercise.order_index, pain_reported: forms[index].pain, notes: forms[index].notes,
          sets: forms[index].sets.map((set, setIndex) => ({ set_number: setIndex + 1, reps: numberOrNull(set.reps), load_kg: numberOrNull(set.load), rir: numberOrNull(set.rir), rpe: numberOrNull(set.rpe), duration_seconds: set.duration ? Number(set.duration) * 60 : null, distance_meters: set.distance ? Number(set.distance) * 1000 : null, completed: set.completed })),
        })),
      };
      await saveWorkoutSession(draft); await onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save workout."); }
    finally { setSaving(false); }
  }

  return <form className="panel workoutLogger" onSubmit={submit}><div className="panelHeader"><h2>Log {day.title}</h2><button className="secondaryButton" onClick={onCancel} type="button">Cancel</button></div>
    {day.exercises.map((exercise, exerciseIndex) => <fieldset className="exerciseLogger" key={exercise.id}><legend>{exercise.exercise_name}</legend><p className="fieldHint">{prescriptionText(exercise)}</p>
      {forms[exerciseIndex].sets.map((set, setIndex) => <div className="setRow" key={setIndex}><strong>Set {setIndex + 1}</strong>
        {exercise.tracking_type === "strength" && <><MiniNumber label="Reps" value={set.reps} onChange={(value) => updateSet(exerciseIndex, setIndex, { reps: value })} /><MiniNumber label="kg" value={set.load} onChange={(value) => updateSet(exerciseIndex, setIndex, { load: value })} /><MiniNumber label="RIR" value={set.rir} onChange={(value) => updateSet(exerciseIndex, setIndex, { rir: value })} /><MiniNumber label="RPE" value={set.rpe} onChange={(value) => updateSet(exerciseIndex, setIndex, { rpe: value })} /></>}
        {exercise.tracking_type !== "strength" && <><MiniNumber label="Minutes" value={set.duration} onChange={(value) => updateSet(exerciseIndex, setIndex, { duration: value })} /><MiniNumber label="Distance km" value={set.distance} onChange={(value) => updateSet(exerciseIndex, setIndex, { distance: value })} /><MiniNumber label="RPE" value={set.rpe} onChange={(value) => updateSet(exerciseIndex, setIndex, { rpe: value })} /></>}
        <label className="setComplete"><input checked={set.completed} onChange={(event) => updateSet(exerciseIndex, setIndex, { completed: event.target.checked })} type="checkbox" />Done</label></div>)}
      <div className="exerciseFeedback"><label><input checked={forms[exerciseIndex].pain} onChange={(event) => updateExercise(exerciseIndex, { pain: event.target.checked })} type="checkbox" />Pain/discomfort</label><input placeholder="Exercise notes" value={forms[exerciseIndex].notes} onChange={(event) => updateExercise(exerciseIndex, { notes: event.target.value })} /></div>
    </fieldset>)}
    <div className="sessionFeedback"><label>Energy<select value={energy} onChange={(event) => setEnergy(event.target.value)}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label><label>Recovery<select value={recovery} onChange={(event) => setRecovery(event.target.value)}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label><label><input checked={pain} onChange={(event) => setPain(event.target.checked)} type="checkbox" />Overall pain</label></div>
    <textarea placeholder="Session notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
    <button disabled={saving} type="submit"><Save size={17} />Save workout</button>{error && <p className="error">{error}</p>}
  </form>;
}

function MiniNumber({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span>{label}</span><input min="0" step="0.1" type="number" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }

function WorkoutReport({ report }: { report: WorkoutRecalibrationReport }) { return <section className="panel recalibrationCard"><div className="panelHeader"><h2>Workout changes and reasons</h2><RefreshCw size={18} /></div><p>{report.summary}</p>{report.changes.length ? <ul>{report.changes.map((change, index) => <li key={`${change.field}-${index}`}><strong>{change.field}: {change.previous_value} → {change.new_value}</strong><span>{change.reason}</span></li>)}</ul> : null}<h3>Evidence used</h3><ul>{report.evidence.map((item) => <li key={item}>{item}</li>)}</ul><p className="confidenceLine">Confidence: {report.confidence}</p></section>; }

function prescriptionText(exercise: WorkoutPlanDay["exercises"][number]): string {
  if (exercise.tracking_type === "strength") return `${exercise.target_sets ?? 1} sets · ${exercise.target_reps_min ?? "?"}–${exercise.target_reps_max ?? "?"} reps${exercise.target_rir !== null ? ` · ${exercise.target_rir} RIR` : ""}`;
  if (exercise.target_duration_s) return `${Math.round(exercise.target_duration_s / 60)} minutes${exercise.target_rpe !== null ? ` · RPE ${exercise.target_rpe}` : ""}`;
  return exercise.notes || "Complete at a comfortable effort";
}
function numberOrNull(value: string): number | null { return value === "" ? null : Number(value); }
function localDate(): string { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
