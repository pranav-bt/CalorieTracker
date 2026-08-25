"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Utensils } from "lucide-react";
import { currentWeekday } from "../domain/routine";
import { getRoutineMeals, logRoutineMeal } from "../db/routine";
import type { PlannedMeal } from "../types";

export function TodayRoutineMeals({ onLogged }: { onLogged: () => Promise<void> | void }) {
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setMeals(await getRoutineMeals(currentWeekday()));
  }

  useEffect(() => { load().catch(() => setError("Could not load today's routine.")); }, []);

  async function log(meal: PlannedMeal) {
    setBusyId(meal.id); setMessage(""); setError("");
    try {
      await logRoutineMeal(meal.id);
      setMessage(`${meal.name} added to today.`);
      await Promise.all([load(), onLogged()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log the planned meal.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel todayRoutine">
      <div className="panelHeader">
        <div><h2>Today&apos;s planned meals</h2><p className="muted">Plans only count after you log them.</p></div>
        <Link className="textButton" href="/routine"><Utensils size={17} />Plan meals</Link>
      </div>
      {meals.length === 0 ? (
        <div className="routineEmpty"><Clock3 size={19} /><span>No breakfast, lunch, or dinner planned for today.</span></div>
      ) : (
        <div className="todayRoutineList">
          {meals.map((meal) => (
            <article key={meal.id}>
              <div><span className="routineSlot">{meal.slot}</span><strong>{meal.name}</strong><small>{meal.total_calories} kcal · P {meal.protein_g}g · C {meal.carbs_g}g · F {meal.fat_g}g</small></div>
              {meal.logged_meal_id ? (
                <span className="loggedBadge"><Check size={15} />Logged</span>
              ) : (
                <button disabled={busyId !== null} onClick={() => log(meal)} type="button">{busyId === meal.id ? "Logging…" : "Log meal"}</button>
              )}
            </article>
          ))}
        </div>
      )}
      {message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}
    </section>
  );
}
