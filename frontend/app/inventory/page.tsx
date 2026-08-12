"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChefHat, Minus, PackagePlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { getFoods } from "../db";
import {
  adjustInventoryQuantity,
  deleteInventoryItem,
  getInventoryItems,
  saveInventoryItem,
} from "../db/inventory";
import type { Food, InventoryItem, Unit } from "../types";

type PantryLocation = InventoryItem["location"];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<Unit>("g");
  const [location, setLocation] = useState<PantryLocation>("pantry");
  const [expiresOn, setExpiresOn] = useState("");
  const [lowStock, setLowStock] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [inventory, knownFoods] = await Promise.all([getInventoryItems(), getFoods()]);
    setItems(inventory);
    setFoods(knownFoods);
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load inventory.")); }, []);

  function selectName(value: string) {
    setName(value);
    const food = foods.find((item) => item.name === value.trim().toLowerCase());
    if (food) setUnit(food.unit);
  }

  function edit(item: InventoryItem) {
    setEditingId(item.id);
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setLocation(item.location);
    setExpiresOn(item.expires_on ?? "");
    setLowStock(item.low_stock_quantity === null ? "" : String(item.low_stock_quantity));
    setMessage(""); setError("");
  }

  function reset() {
    setEditingId(null); setName(""); setQuantity(""); setUnit("g"); setLocation("pantry");
    setExpiresOn(""); setLowStock("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const food = foods.find((item) => item.name === name.trim().toLowerCase());
      await saveInventoryItem({
        food_id: food?.id ?? null,
        name,
        quantity: Number(quantity),
        unit,
        location,
        expires_on: expiresOn || null,
        low_stock_quantity: lowStock === "" ? null : Number(lowStock),
      }, editingId ?? undefined);
      setMessage(editingId ? "Inventory item updated." : "Ingredient added to inventory.");
      reset(); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save ingredient."); }
  }

  async function adjust(item: InventoryItem, direction: -1 | 1) {
    const step = item.unit === "g" || item.unit === "ml" ? 10 : 1;
    await adjustInventoryQuantity(item.id, step * direction);
    await load();
  }

  async function remove(id: number) { await deleteInventoryItem(id); if (editingId === id) reset(); await load(); }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? items.filter((item) => item.name.includes(normalized) || item.location.includes(normalized)) : items;
  }, [items, query]);

  return (
    <section className="pageStack">
      <div className="pageHeader"><div><p className="eyebrow">Local pantry</p><h1>Inventory</h1></div><Link className="textButton" href="/recipes"><ChefHat size={17} />Find recipes</Link></div>
      <form className="panel inventoryForm" onSubmit={submit}>
        <div className="panelHeader"><h2>{editingId ? "Edit ingredient" : "Add ingredient"}</h2>{editingId ? <button className="iconButton" onClick={reset} title="Cancel edit" type="button"><X size={16} /></button> : <PackagePlus size={18} />}</div>
        <datalist id="inventory-foods">{foods.map((food) => <option key={food.id} value={food.name} />)}</datalist>
        <div className="profileGrid">
          <label className="stackedField"><span>Ingredient</span><input list="inventory-foods" placeholder="e.g. oats" required value={name} onBlur={(e) => selectName(e.target.value)} onChange={(e) => selectName(e.target.value)} /></label>
          <label className="stackedField"><span>Quantity</span><input min="0" required step="0.01" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label className="stackedField"><span>Unit</span><select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}><option value="g">g</option><option value="ml">ml</option><option value="piece">piece</option><option value="slice">slice</option></select></label>
          <label className="stackedField"><span>Location</span><select value={location} onChange={(e) => setLocation(e.target.value as PantryLocation)}><option value="pantry">Pantry</option><option value="fridge">Fridge</option><option value="freezer">Freezer</option><option value="other">Other</option></select></label>
          <label className="stackedField"><span>Expiry (optional)</span><input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /></label>
          <label className="stackedField"><span>Low-stock warning at</span><input min="0" step="0.01" type="number" value={lowStock} onChange={(e) => setLowStock(e.target.value)} /></label>
        </div>
        <button type="submit"><PackagePlus size={17} />{editingId ? "Save changes" : "Add to inventory"}</button>
        {message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}
      </form>

      <section className="panel">
        <div className="panelHeader"><h2>Available ingredients</h2><Search size={18} /></div>
        <input aria-label="Search inventory" placeholder="Search ingredient or location" value={query} onChange={(e) => setQuery(e.target.value)} />
        {filtered.length ? <ul className="inventoryList">{filtered.map((item) => {
          const low = item.low_stock_quantity !== null && item.quantity <= item.low_stock_quantity;
          const expiring = isExpiringSoon(item.expires_on);
          return <li key={item.id}>
            <div className="inventoryIdentity"><strong>{item.name}</strong><small>{item.location}{item.expires_on ? ` · expires ${item.expires_on}` : ""}</small><div className="inventoryFlags">{low && <span className="warningPill">Low stock</span>}{expiring && <span className="warningPill">Use soon</span>}</div></div>
            <div className="quantityStepper"><button className="iconButton" onClick={() => adjust(item, -1)} title="Decrease" type="button"><Minus size={15} /></button><strong>{item.quantity} {item.unit}</strong><button className="iconButton" onClick={() => adjust(item, 1)} title="Increase" type="button"><Plus size={15} /></button></div>
            <div className="inventoryActions"><button className="iconButton" onClick={() => edit(item)} title="Edit" type="button"><Pencil size={15} /></button><button className="iconButton danger" onClick={() => remove(item.id)} title="Delete" type="button"><Trash2 size={15} /></button></div>
          </li>;
        })}</ul> : <p className="muted">No ingredients in inventory yet.</p>}
      </section>
    </section>
  );
}

function isExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const days = Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
  return days <= 3;
}
