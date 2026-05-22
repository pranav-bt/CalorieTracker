"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Pencil, Save, Search, Trash2, X } from "lucide-react";
import { deleteFood, getFoods, updateFood, upsertFood } from "../db";
import type { Food, Unit } from "../types";

export default function FoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodName, setFoodName] = useState("almond");
  const [foodQuantity, setFoodQuantity] = useState("10");
  const [foodUnit, setFoodUnit] = useState<Unit>("g");
  const [foodCalories, setFoodCalories] = useState("58");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadFoods() {
    setFoods(await getFoods());
  }

  useEffect(() => {
    loadFoods().catch(() => setError("Backend is not reachable."));
  }, []);

  function startEdit(food: Food) {
    setEditingId(food.id);
    setFoodName(food.name);
    setFoodQuantity(String(food.reference_quantity));
    setFoodUnit(food.unit as Unit);
    setFoodCalories(String(food.reference_calories));
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setFoodName("almond");
    setFoodQuantity("10");
    setFoodUnit("g");
    setFoodCalories("58");
    setMessage("");
    setError("");
  }

  async function submitFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateFoodForm(foodName, foodQuantity, foodCalories);
    if (validationError) { setError(validationError); return; }

    try {
      const payload = {
        name: foodName.trim(),
        unit: foodUnit,
        reference_quantity: Number(foodQuantity),
        reference_calories: Number(foodCalories),
      };
      const savedFood = editingId
        ? await updateFood(editingId, payload)
        : await upsertFood(payload);
      setMessage(`Saved "${savedFood.name}" successfully.`);
      setEditingId(null);
      await loadFoods();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save food.");
    }
  }

  async function handleDeleteFood(food: Food) {
    setError("");
    setMessage("");
    try {
      await deleteFood(food.id);
      setMessage(`Deleted "${food.name}".`);
      if (editingId === food.id) cancelEdit();
      await loadFoods();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete food.");
    }
  }

  const filteredFoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? foods.filter((f) => f.name.includes(q)) : foods;
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
          <h2>{editingId ? "Edit food" : "Add or update food"}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {editingId && (
              <button className="iconButton" onClick={cancelEdit} title="Cancel edit" type="button">
                <X size={16} />
              </button>
            )}
            <BookOpen size={18} />
          </div>
        </div>
        <div className="fieldGrid">
          <label>
            <span>Name</span>
            <input
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g. almond"
            />
          </label>
          <label>
            <span>Quantity</span>
            <input
              min="0.01"
              step="0.01"
              type="number"
              value={foodQuantity}
              onChange={(e) => setFoodQuantity(e.target.value)}
            />
          </label>
          <label>
            <span>Unit</span>
            <select value={foodUnit} onChange={(e) => setFoodUnit(e.target.value as Unit)}>
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
              onChange={(e) => setFoodCalories(e.target.value)}
            />
          </label>
        </div>
        <button type="submit">
          <Save size={18} />
          {editingId ? "Save changes" : "Save food"}
        </button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
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
          onChange={(e) => setQuery(e.target.value)}
        />
        {filteredFoods.length ? (
          <ul className="foodList">
            {filteredFoods.map((food) => (
              <li key={food.id} className={`foodListItem ${editingId === food.id ? "editing" : ""}`}>
                <span>{food.name}</span>
                <strong>
                  {food.reference_calories} kcal / {food.reference_quantity} {food.unit}
                </strong>
                <div className="foodListActions">
                  <button
                    className="iconButton"
                    onClick={() => startEdit(food)}
                    title={`Edit ${food.name}`}
                    type="button"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="iconButton danger"
                    onClick={() => handleDeleteFood(food)}
                    title={`Delete ${food.name}`}
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
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

function validateFoodForm(name: string, quantity: string, calories: string): string | null {
  if (!name.trim()) return "Please enter a food name.";
  const qty = Number(quantity);
  if (!quantity || isNaN(qty) || qty <= 0) return "Quantity must be greater than zero.";
  const cal = Number(calories);
  if (calories === "" || isNaN(cal) || cal < 0) return "Calories must be zero or more.";
  return null;
}

