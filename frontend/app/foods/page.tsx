"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Save, Search } from "lucide-react";
import { API_BASE_URL } from "../config";
import type { Food, Unit } from "../types";

export default function FoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodName, setFoodName] = useState("almond");
  const [foodQuantity, setFoodQuantity] = useState("10");
  const [foodUnit, setFoodUnit] = useState<Unit>("g");
  const [foodCalories, setFoodCalories] = useState("58");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadFoods() {
    const response = await fetch(`${API_BASE_URL}/foods`);
    if (!response.ok) throw new Error("Could not load foods.");
    setFoods(await response.json());
  }

  useEffect(() => {
    loadFoods().catch(() => setError("Backend is not reachable."));
  }, []);

  async function submitFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/foods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: foodName,
          unit: foodUnit,
          reference_quantity: Number(foodQuantity),
          reference_calories: Number(foodCalories),
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail ?? "Could not save food.");
      }

      const savedFood = (await response.json()) as Food;
      setMessage(`Saved ${savedFood.name}`);
      await loadFoods();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save food.");
    }
  }

  const filteredFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return foods;
    return foods.filter((food) => food.name.includes(normalizedQuery));
  }, [foods, query]);

  return (
    <section className="pageStack">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Local only</p>
          <h1>Food Database</h1>
        </div>
      </div>

      <form className="panel foodForm" onSubmit={submitFood}>
        <div className="panelHeader">
          <h2>Add or update food</h2>
          <BookOpen size={18} />
        </div>
        <div className="fieldGrid">
          <label>
            <span>Name</span>
            <input
              value={foodName}
              onChange={(event) => setFoodName(event.target.value)}
              placeholder="almond"
            />
          </label>
          <label>
            <span>Quantity</span>
            <input
              min="0.01"
              step="0.01"
              type="number"
              value={foodQuantity}
              onChange={(event) => setFoodQuantity(event.target.value)}
            />
          </label>
          <label>
            <span>Unit</span>
            <select
              value={foodUnit}
              onChange={(event) => setFoodUnit(event.target.value as Unit)}
            >
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="piece">piece</option>
              <option value="slice">slice</option>
            </select>
          </label>
          <label>
            <span>Calories</span>
            <input
              min="0"
              step="1"
              type="number"
              value={foodCalories}
              onChange={(event) => setFoodCalories(event.target.value)}
            />
          </label>
        </div>
        <button type="submit">
          <Save size={18} />
          Save food
        </button>
        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>

      <section className="panel">
        <div className="panelHeader">
          <h2>Known foods</h2>
          <Search size={18} />
        </div>
        <input
          aria-label="Search foods"
          placeholder="Search foods"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {filteredFoods.length ? (
          <ul className="foodList">
            {filteredFoods.map((food) => (
              <li key={food.id}>
                <span>{food.name}</span>
                <strong>
                  {food.reference_calories} / {food.reference_quantity} {food.unit}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No matching foods.</p>
        )}
      </section>
    </section>
  );
}

