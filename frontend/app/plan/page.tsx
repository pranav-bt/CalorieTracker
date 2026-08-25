"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { History, RefreshCw, RotateCcw, Save, Target, Trash2 } from "lucide-react";
import {
  addBodyMeasurement,
  calculateAndSaveNutritionPlan,
  discardNutritionPlan,
  getBodyMeasurements,
  getCalculatorDraft,
  getLatestRecalibrationReport,
  getNutritionPlans,
  getUserProfile,
  restoreNutritionPlan,
  saveCalculatorDraft,
  type StoredNutritionPlan,
  unarchiveNutritionPlan,
} from "../db/plans";
import type {
  ActivityLevel,
  CurrentState,
  GoalKind,
  MetabolicSex,
  PhysiqueGoal,
  RecalibrationReport,
  UserProfile,
} from "../types";
import { phaseImpact, phaseLabel, recommendPhase } from "../domain/goalGuidance";
import { BodyProgressCharts } from "../components/BodyProgressCharts";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type FormState = {
  birthDate: string;
  metabolicSex: MetabolicSex;
  heightCm: string;
  weightKg: string;
  bodyFat: string;
  waist: string;
  chest: string;
  hips: string;
  arm: string;
  thigh: string;
  activityLevel: ActivityLevel;
  physiqueGoal: PhysiqueGoal;
  currentState: CurrentState;
  phaseOverride: "" | GoalKind;
  targetWeightKg: string;
  targetDate: string;
  eventName: string;
  eventDate: string;
  workoutDays: string;
  preferredWorkoutDays: number[];
  sessionMinutes: string;
  flexDay: boolean;
  flexWeekday: number;
  flexCalories: string;
  dietaryPreferences: string;
  equipment: string;
  limitations: string;
};

const INITIAL_FORM: FormState = {
  birthDate: "",
  metabolicSex: "female",
  heightCm: "",
  weightKg: "",
  bodyFat: "",
  waist: "",
  chest: "",
  hips: "",
  arm: "",
  thigh: "",
  activityLevel: "light",
  physiqueGoal: "fit_defined",
  currentState: "both_unsure",
  phaseOverride: "",
  targetWeightKg: "",
  targetDate: "",
  eventName: "",
  eventDate: "",
  workoutDays: "3",
  preferredWorkoutDays: [0, 2, 4],
  sessionMinutes: "45",
  flexDay: false,
  flexWeekday: 5,
  flexCalories: "",
  dietaryPreferences: "",
  equipment: "",
  limitations: "",
};

export default function PlanPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [plans, setPlans] = useState<StoredNutritionPlan[]>([]);
  const [activePlan, setActivePlan] = useState<StoredNutritionPlan | null>(null);
  const [report, setReport] = useState<RecalibrationReport | null>(null);
  const [measurements, setMeasurements] = useState<import("../types").BodyMeasurement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastDiscardedPlan, setLastDiscardedPlan] = useState<{ id: number; wasActive: boolean } | null>(null);
  const draftRef = useRef(form);
  const draftReadyRef = useRef(false);
  const recommendation = recommendPhase(form.physiqueGoal, form.currentState);
  const selectedPhase = form.phaseOverride || recommendation.goal;

  useEffect(() => {
    load().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Could not load your plan.");
      setIsLoading(false);
    });
  }, []);

  async function load() {
    const [profile, measurements, savedPlans, latestReport, draft] = await Promise.all([
      getUserProfile(),
      getBodyMeasurements(60),
      getNutritionPlans(3),
      getLatestRecalibrationReport(),
      getCalculatorDraft<FormState>(),
    ]);
    setForm((current) => {
      const fromSaved = profile
        ? profileToForm(profile, measurements[0], current)
        : measurements[0]
          ? measurementToForm(measurements[0], current)
          : current;
      if (!draft) return fromSaved;
      return {
        ...fromSaved,
        ...draft,
        preferredWorkoutDays: Array.isArray(draft.preferredWorkoutDays)
          ? draft.preferredWorkoutDays
          : fromSaved.preferredWorkoutDays,
      };
    });
    setPlans(savedPlans);
    setMeasurements(measurements);
    setActivePlan(savedPlans.find((plan) => plan.is_active) ?? savedPlans[0] ?? null);
    setReport(latestReport);
    draftReadyRef.current = true;
    setIsLoading(false);
  }

  useEffect(() => {
    if (isLoading) return;
    draftRef.current = form;
    const timer = window.setTimeout(() => {
      saveCalculatorDraft(form as unknown as Record<string, unknown>).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form, isLoading]);

  useEffect(() => () => {
    if (draftReadyRef.current) {
      saveCalculatorDraft(draftRef.current as unknown as Record<string, unknown>).catch(() => undefined);
    }
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleWorkoutDay(day: number) {
    setForm((current) => ({
      ...current,
      preferredWorkoutDays: current.preferredWorkoutDays.includes(day)
        ? current.preferredWorkoutDays.filter((value) => value !== day)
        : [...current.preferredWorkoutDays, day].sort(),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const validation = validate(form);
    if (validation) {
      setError(validation);
      return;
    }
    setIsLoading(true);
    try {
      const profile = formToProfile(form);
      const weightKg = Number(form.weightKg);
      const plan = await calculateAndSaveNutritionPlan(
        profile,
        weightKg,
        plans.length ? "recalibration" : "initial"
      );
      await addBodyMeasurement({
        recorded_at: localDate(),
        weight_kg: weightKg,
        body_fat_percent: optionalNumber(form.bodyFat),
        waist_cm: optionalNumber(form.waist),
        chest_cm: optionalNumber(form.chest),
        hips_cm: optionalNumber(form.hips),
        arm_cm: optionalNumber(form.arm),
        thigh_cm: optionalNumber(form.thigh),
        notes: "",
      });
      setActivePlan(plan);
      setMessage(plans.length ? "Plan recalibrated. Review the changes below." : "Your first plan is active.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not calculate your plan.");
      setIsLoading(false);
    }
  }

  async function restore(planId: number) {
    setError("");
    setIsLoading(true);
    try {
      await restoreNutritionPlan(planId);
      setMessage("Previous plan restored.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restore plan.");
      setIsLoading(false);
    }
  }

  async function discard(planId: number) {
    if (!window.confirm("Discard this plan? If it is active, the previous plan will be restored automatically.")) return;
    setError("");
    try {
      const wasActive = activePlan?.id === planId;
      await discardNutritionPlan(planId);
      setLastDiscardedPlan({ id: planId, wasActive });
      setMessage("Plan discarded. The previous plan is active, or manual targets are being used if none remains.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not discard plan.");
    }
  }

  async function undoDiscard() {
    if (lastDiscardedPlan === null) return;
    setIsLoading(true); setError("");
    try {
      if (lastDiscardedPlan.wasActive) await restoreNutritionPlan(lastDiscardedPlan.id);
      else await unarchiveNutritionPlan(lastDiscardedPlan.id);
      await load();
      setLastDiscardedPlan(null);
      setMessage(lastDiscardedPlan.wasActive ? "Discard undone. The plan is active again." : "Discard undone.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not undo discard.");
      setIsLoading(false);
    }
  }

  return (
    <section className="pageStack">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Offline planning</p>
          <h1>Macro Calculator</h1>
        </div>
      </div>

      <form className="panel planForm" onSubmit={submit}>
        <div className="panelHeader"><h2>Current profile and goal</h2><Target size={18} /></div>
        <div className="profileGrid">
          <Field label="Date of birth"><input required type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} /></Field>
          <Field label="Sex used by equation">
            <select value={form.metabolicSex} onChange={(e) => update("metabolicSex", e.target.value as MetabolicSex)}>
              <option value="female">Female</option><option value="male">Male</option>
            </select>
          </Field>
          <Field label="Height (cm)"><NumberInput value={form.heightCm} onChange={(value) => update("heightCm", value)} /></Field>
          <Field label="Current weight (kg)"><NumberInput value={form.weightKg} onChange={(value) => update("weightKg", value)} /></Field>
          <Field label="Daily activity">
            <select value={form.activityLevel} onChange={(e) => update("activityLevel", e.target.value as ActivityLevel)}>
              <option value="sedentary">Mostly seated</option><option value="light">Lightly active</option>
              <option value="moderate">Moderately active</option><option value="very_active">Very active</option>
            </select>
          </Field>
          <Field label="How do you want to look or perform?">
            <select value={form.physiqueGoal} onChange={(e) => { update("physiqueGoal", e.target.value as PhysiqueGoal); update("phaseOverride", ""); }}>
              <option value="leaner">Leaner</option>
              <option value="fit_defined">Fit and defined</option>
              <option value="muscular">Bigger and stronger</option>
              <option value="maintain">Maintain my current physique</option>
              <option value="performance">Prepare for an event</option>
            </select>
          </Field>
          {form.physiqueGoal !== "maintain" && form.physiqueGoal !== "performance" && (
            <Field label="Which best describes you now?">
              <select value={form.currentState} onChange={(e) => { update("currentState", e.target.value as CurrentState); update("phaseOverride", ""); }}>
                <option value="reduce_fat">I mainly want to reduce body fat</option>
                <option value="fairly_lean_gain_muscle">I am fairly lean and want more muscle</option>
                <option value="both_unsure">I want both, or I am unsure</option>
              </select>
            </Field>
          )}
          <Field label="Target weight (kg, optional)"><NumberInput required={false} value={form.targetWeightKg} onChange={(value) => update("targetWeightKg", value)} /></Field>
          <Field label="Target date (optional)"><input type="date" value={form.targetDate} onChange={(e) => update("targetDate", e.target.value)} /></Field>
        </div>

        <section className="phaseRecommendation">
          <span className="metricLabel">Recommended first phase</span>
          <h3>{phaseLabel(selectedPhase)}</h3>
          <p>{form.phaseOverride ? phaseImpact(form.phaseOverride) : recommendation.explanation}</p>
          {!form.phaseOverride && recommendation.next_step && <p><strong>Later:</strong> {recommendation.next_step}</p>}
          <details>
            <summary>Choose a different first phase</summary>
            <label className="stackedField">
              <span>Phase override</span>
              <select value={form.phaseOverride} onChange={(event) => update("phaseOverride", event.target.value as FormState["phaseOverride"])}>
                <option value="">Use recommendation</option>
                <option value="fat_loss">Fat-loss phase</option>
                <option value="recomposition">Recomposition phase</option>
                <option value="muscle_gain">Lean muscle-building phase</option>
                <option value="maintain">Maintain</option>
                <option value="performance">Performance</option>
              </select>
            </label>
          </details>
        </section>

        <details className="formDetails">
          <summary>Body measurements and event details</summary>
          <div className="profileGrid detailsGrid">
            <Field label="Body fat %"><NumberInput required={false} value={form.bodyFat} onChange={(value) => update("bodyFat", value)} /></Field>
            <Field label="Waist (cm)"><NumberInput required={false} value={form.waist} onChange={(value) => update("waist", value)} /></Field>
            <Field label="Chest (cm)"><NumberInput required={false} value={form.chest} onChange={(value) => update("chest", value)} /></Field>
            <Field label="Hips (cm)"><NumberInput required={false} value={form.hips} onChange={(value) => update("hips", value)} /></Field>
            <Field label="Arm (cm)"><NumberInput required={false} value={form.arm} onChange={(value) => update("arm", value)} /></Field>
            <Field label="Thigh (cm)"><NumberInput required={false} value={form.thigh} onChange={(value) => update("thigh", value)} /></Field>
            <Field label="Event"><input placeholder="Marathon, Hyrox…" value={form.eventName} onChange={(e) => update("eventName", e.target.value)} /></Field>
            <Field label="Event date"><input type="date" value={form.eventDate} onChange={(e) => update("eventDate", e.target.value)} /></Field>
          </div>
        </details>

        <div className="profileGrid">
          <Field label="Workout days per week"><NumberInput max="7" min="0" step="1" value={form.workoutDays} onChange={(value) => update("workoutDays", value)} /></Field>
          <Field label="Minutes per session"><NumberInput max="240" min="10" step="5" value={form.sessionMinutes} onChange={(value) => update("sessionMinutes", value)} /></Field>
        </div>
        <fieldset className="dayPicker">
          <legend>Preferred workout days</legend>
          {DAYS.map((day, index) => (
            <label key={day}><input checked={form.preferredWorkoutDays.includes(index)} onChange={() => toggleWorkoutDay(index)} type="checkbox" />{day.slice(0, 3)}</label>
          ))}
        </fieldset>
        <div className="inlineControl">
          <label><input checked={form.flexDay} onChange={(e) => update("flexDay", e.target.checked)} type="checkbox" />Include one flex day</label>
          {form.flexDay && <select aria-label="Flex day" value={form.flexWeekday} onChange={(e) => update("flexWeekday", Number(e.target.value))}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select>}
        </div>
        {form.flexDay && (
          <Field label="Flex-day calories (optional)">
            <NumberInput required={false} min="1200" step="25" value={form.flexCalories} onChange={(value) => update("flexCalories", value)} />
            <small className="fieldHint">Leave blank for automatic distribution. A custom target redistributes calories across the other days while preserving the weekly total.</small>
          </Field>
        )}

        <details className="formDetails">
          <summary>Diet, equipment, and limitations</summary>
          <div className="profileGrid detailsGrid">
            <Field label="Diet preferences"><input placeholder="vegetarian, high protein" value={form.dietaryPreferences} onChange={(e) => update("dietaryPreferences", e.target.value)} /></Field>
            <Field label="Available equipment"><input placeholder="dumbbells, gym" value={form.equipment} onChange={(e) => update("equipment", e.target.value)} /></Field>
            <Field label="Injuries or limitations"><input placeholder="optional" value={form.limitations} onChange={(e) => update("limitations", e.target.value)} /></Field>
          </div>
        </details>

        <button disabled={isLoading} type="submit">{plans.length ? <RefreshCw size={18} /> : <Save size={18} />}{plans.length ? "Recalibrate" : "Create plan"}</button>
        {message && <p className="success">{message}</p>}
        {lastDiscardedPlan !== null && <button className="secondaryButton" onClick={undoDiscard} type="button"><RotateCcw size={16} />Undo discard</button>}
        {error && <p className="error">{error}</p>}
      </form>

      {activePlan && <PlanResult plan={activePlan} />}
      <BodyProgressCharts measurements={measurements} />
      {report && <RecalibrationCard report={report} />}

      {plans.length > 0 && (
        <section className="panel">
          <div className="panelHeader"><h2>Last three plans</h2><History size={18} /></div>
          <ul className="planHistory">
            {plans.map((plan) => (
              <li key={plan.id}>
                <div><strong>{plan.calories} kcal/day</strong><small>{new Date(plan.created_at).toLocaleString()} · {plan.source.replace("_", " ")}</small></div>
                <div className="historyActions">
                  {plan.is_active ? <span className="activePill">Active</span> : <button className="secondaryButton" onClick={() => restore(plan.id)} type="button"><RotateCcw size={15} />Restore</button>}
                  <button className="iconButton danger" aria-label="Discard plan" onClick={() => discard(plan.id)} type="button"><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function PlanResult({ plan }: { plan: StoredNutritionPlan }) {
  return (
    <section className="panel">
      <div className="panelHeader"><h2>Active daily baseline</h2><Target size={18} /></div>
      <div className="summaryBand compact">
        <div><span className="metricLabel">Calories</span><strong>{plan.calories}</strong></div>
        <div><span className="metricLabel">Protein</span><strong>{plan.protein_g}g</strong></div>
        <div><span className="metricLabel">Carbs</span><strong>{plan.carbs_g}g</strong></div>
        <div><span className="metricLabel">Fat</span><strong>{plan.fat_g}g</strong></div>
      </div>
      <p className="planExplanation">{plan.explanation}</p>
      <div className="planWeekGrid">
        {plan.days.map((day) => <div key={day.weekday}><span>{DAYS[day.weekday].slice(0, 3)}</span><strong>{day.calories}</strong><small>{day.day_kind.replace("_", " + ")}</small></div>)}
      </div>
    </section>
  );
}

function RecalibrationCard({ report }: { report: RecalibrationReport }) {
  return (
    <section className="panel recalibrationCard">
      <div className="panelHeader"><h2>What changed and why</h2><RefreshCw size={18} /></div>
      <p>{report.summary}</p>
      {report.changes.length > 0 && <ul>{report.changes.map((change, index) => <li key={`${change.field}-${index}`}><strong>{change.field}: {change.previous_value} → {change.new_value}</strong><span>{change.reason}</span></li>)}</ul>}
      <h3>Evidence used</h3>
      <ul>{report.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="confidenceLine">Confidence: {report.confidence}. More consistent history will improve future recalibration.</p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="stackedField"><span>{label}</span>{children}</label>;
}

function NumberInput({ value, onChange, required = true, min = "0", max, step = "0.1" }: { value: string; onChange: (value: string) => void; required?: boolean; min?: string; max?: string; step?: string }) {
  return <input max={max} min={min} required={required} step={step} type="number" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function validate(form: FormState): string | null {
  if (!form.birthDate) return "Enter a date of birth.";
  if (!form.heightCm || Number(form.heightCm) <= 0) return "Enter a valid height.";
  if (!form.weightKg || Number(form.weightKg) <= 0) return "Enter a valid current weight.";
  const workoutDays = Number(form.workoutDays);
  if (!Number.isInteger(workoutDays) || workoutDays < 0 || workoutDays > 7) return "Workout days must be between 0 and 7.";
  if (form.preferredWorkoutDays.length !== workoutDays) return `Select exactly ${workoutDays} preferred workout day${workoutDays === 1 ? "" : "s"}.`;
  if (form.flexDay && form.flexCalories && Number(form.flexCalories) < 1200) return "Flex-day calories must be at least 1200.";
  return null;
}

function formToProfile(form: FormState): UserProfile {
  const recommended = recommendPhase(form.physiqueGoal, form.currentState);
  return {
    birth_date: form.birthDate,
    metabolic_sex: form.metabolicSex,
    height_cm: Number(form.heightCm),
    activity_level: form.activityLevel,
    primary_goal: form.phaseOverride || recommended.goal,
    physique_goal: form.physiqueGoal,
    current_state: form.currentState,
    target_weight_kg: optionalNumber(form.targetWeightKg),
    target_date: form.targetDate || null,
    event_name: form.eventName.trim(),
    event_date: form.eventDate || null,
    workout_days_per_week: Number(form.workoutDays),
    preferred_workout_days: form.preferredWorkoutDays,
    workout_session_minutes: Number(form.sessionMinutes),
    flex_days_per_week: form.flexDay ? 1 : 0,
    flex_day_weekday: form.flexDay ? form.flexWeekday : null,
    flex_day_calorie_target: form.flexDay ? optionalNumber(form.flexCalories) : null,
    dietary_preferences: csv(form.dietaryPreferences),
    available_equipment: csv(form.equipment),
    injuries_or_limitations: csv(form.limitations),
  };
}

function profileToForm(profile: UserProfile, measurement: import("../types").BodyMeasurement | undefined, current: FormState): FormState {
  const recommended = recommendPhase(profile.physique_goal, profile.current_state);
  return measurementToForm(measurement, {
    ...current,
    birthDate: profile.birth_date,
    metabolicSex: profile.metabolic_sex,
    heightCm: String(profile.height_cm),
    activityLevel: profile.activity_level,
    physiqueGoal: profile.physique_goal,
    currentState: profile.current_state,
    phaseOverride: profile.primary_goal === recommended.goal ? "" : profile.primary_goal,
    targetWeightKg: profile.target_weight_kg === null ? "" : String(profile.target_weight_kg),
    targetDate: profile.target_date ?? "",
    eventName: profile.event_name,
    eventDate: profile.event_date ?? "",
    workoutDays: String(profile.workout_days_per_week),
    preferredWorkoutDays: profile.preferred_workout_days,
    sessionMinutes: String(profile.workout_session_minutes),
    flexDay: profile.flex_days_per_week > 0,
    flexWeekday: profile.flex_day_weekday ?? 5,
    flexCalories: profile.flex_day_calorie_target === null ? "" : String(profile.flex_day_calorie_target),
    dietaryPreferences: profile.dietary_preferences.join(", "),
    equipment: profile.available_equipment.join(", "),
    limitations: profile.injuries_or_limitations.join(", "),
  });
}

function measurementToForm(measurement: import("../types").BodyMeasurement | undefined, current: FormState): FormState {
  if (!measurement) return current;
  return {
    ...current,
    weightKg: String(measurement.weight_kg),
    bodyFat: optionalString(measurement.body_fat_percent),
    waist: optionalString(measurement.waist_cm),
    chest: optionalString(measurement.chest_cm),
    hips: optionalString(measurement.hips_cm),
    arm: optionalString(measurement.arm_cm),
    thigh: optionalString(measurement.thigh_cm),
  };
}

function optionalNumber(value: string): number | null { return value === "" ? null : Number(value); }
function optionalString(value: number | null): string { return value === null ? "" : String(value); }
function csv(value: string): string[] { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function localDate(): string { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
