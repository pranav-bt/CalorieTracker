"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { AlertTriangle, PackageOpen } from "lucide-react";
import { getInventoryItems } from "../db/inventory";
import { inventoryExpiryAlerts, inventoryExpiryStatus } from "../domain/inventory";
import type { InventoryItem } from "../types";

export function InventoryExpiryAlerts() {
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    getInventoryItems().then(setItems).catch(() => {
      // Inventory warnings are supplementary and must not block Home.
    });
  }, []);

  const alerts = useMemo(() => inventoryExpiryAlerts(items), [items]);
  if (!alerts.length) return null;

  const expiredCount = alerts.filter((item) => inventoryExpiryStatus(item.expires_on) === "expired").length;
  return (
    <section className="inventoryReminder" aria-label="Pantry expiry reminders">
      <AlertTriangle size={20} />
      <div>
        <strong>{expiredCount ? `${expiredCount} expired` : "Use pantry items soon"}</strong>
        <p>{alerts.slice(0, 3).map((item) => `${displayName(item.name)} (${expiryLabel(item.expires_on)})`).join(" · ")}{alerts.length > 3 ? ` · +${alerts.length - 3} more` : ""}</p>
      </div>
      <Link className="textButton secondaryButton" href="/inventory"><PackageOpen size={16} />Review</Link>
    </section>
  );
}

function expiryLabel(expiresOn: string | null): string {
  const status = inventoryExpiryStatus(expiresOn);
  if (status === "expired") return "expired";
  if (status === "today") return "expires today";
  return `expires ${expiresOn}`;
}

function displayName(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
