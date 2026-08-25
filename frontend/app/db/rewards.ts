"use client";

import { Capacitor } from "@capacitor/core";
import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import type { PointRule, RewardConfiguration, RewardItem, RewardMessage, RewardPreferences } from "../types";
import { getDb, inTransaction } from "./client";

export type RewardRuntime = {
  preferences: RewardPreferences;
  pointRules: Map<string, PointRule>;
  messages: RewardMessage[];
};

const DISABLED_PREFERENCES: RewardPreferences = {
  enabled: false, motivations_enabled: false, love_notes_enabled: false,
  weekly_challenges_enabled: false, points_enabled: false, system_name: "Rewards",
  point_name_singular: "point", point_name_plural: "points", weekly_points_goal: 0,
};

function requireAndroid(): void {
  if (!Capacitor.isNativePlatform()) throw new Error("Reward settings are available in the Android app.");
}

function rowToPreferences(row: Record<string, unknown>): RewardPreferences {
  return {
    enabled: Boolean(row.enabled), motivations_enabled: Boolean(row.motivations_enabled),
    love_notes_enabled: Boolean(row.love_notes_enabled), weekly_challenges_enabled: Boolean(row.weekly_challenges_enabled),
    points_enabled: Boolean(row.points_enabled), system_name: String(row.system_name),
    point_name_singular: String(row.point_name_singular), point_name_plural: String(row.point_name_plural),
    weekly_points_goal: Number(row.weekly_points_goal),
  };
}

export async function loadRewardRuntime(db: SQLiteDBConnection): Promise<RewardRuntime> {
  const [preferenceResult, ruleResult, messageResult] = await Promise.all([
    db.query("SELECT * FROM reward_preferences WHERE id=1"),
    db.query("SELECT action_key, label, points, enabled FROM point_rules ORDER BY rowid"),
    db.query("SELECT id, category, context_key, text, order_index FROM reward_messages ORDER BY category, context_key, order_index, id"),
  ]);
  const preferenceRow = preferenceResult.values?.[0] as Record<string, unknown> | undefined;
  const preferences = preferenceRow ? rowToPreferences(preferenceRow) : DISABLED_PREFERENCES;
  const rules = (ruleResult.values ?? []).map((row): PointRule => ({
    action_key: String(row.action_key), label: String(row.label), points: Number(row.points), enabled: Boolean(row.enabled),
  }));
  return {
    preferences,
    pointRules: new Map(rules.map((rule) => [rule.action_key, rule])),
    messages: (messageResult.values ?? []).map((row): RewardMessage => ({
      id: Number(row.id), category: String(row.category), context_key: String(row.context_key),
      text: String(row.text), order_index: Number(row.order_index),
    })),
  };
}

export function rewardMessagePool(runtime: RewardRuntime, category: string, contextKey = ""): string[] {
  return runtime.messages
    .filter((message) => message.category === category && message.context_key === contextKey)
    .map((message) => message.text);
}

export function configuredPointValue(runtime: RewardRuntime, actionKey: string): number {
  if (!runtime.preferences.enabled || !runtime.preferences.points_enabled) return 0;
  const rule = runtime.pointRules.get(actionKey);
  return rule?.enabled ? rule.points : 0;
}

export async function awardConfiguredPoints(
  db: SQLiteDBConnection,
  actionKey: string,
  transaction = true
): Promise<number> {
  const runtime = await loadRewardRuntime(db);
  const points = configuredPointValue(runtime, actionKey);
  if (points > 0) await db.run("INSERT INTO heart_points_log (source, points) VALUES (?, ?)", [actionKey, points], transaction);
  return points;
}

export async function getRewardConfiguration(): Promise<RewardConfiguration> {
  requireAndroid();
  const db = await getDb();
  const runtime = await loadRewardRuntime(db);
  const { values } = await db.query("SELECT id, name, cost FROM rewards_catalogue WHERE enabled=1 ORDER BY id");
  return {
    preferences: runtime.preferences,
    point_rules: [...runtime.pointRules.values()],
    rewards: (values ?? []).map((row): RewardItem => ({ id: Number(row.id), name: String(row.name), cost: Number(row.cost) })),
    messages: runtime.messages,
  };
}

export async function saveRewardPreferences(preferences: RewardPreferences): Promise<void> {
  requireAndroid();
  const systemName = preferences.system_name.trim();
  const singular = preferences.point_name_singular.trim();
  const plural = preferences.point_name_plural.trim();
  if (!systemName || !singular || !plural) throw new Error("Reward and point names cannot be empty.");
  if (!Number.isInteger(preferences.weekly_points_goal) || preferences.weekly_points_goal < 0 || preferences.weekly_points_goal > 100000) {
    throw new Error("Weekly point goal must be a whole number from 0 to 100000.");
  }
  const db = await getDb();
  await db.run(
    `UPDATE reward_preferences SET enabled=?, motivations_enabled=?, love_notes_enabled=?,
       weekly_challenges_enabled=?, points_enabled=?, system_name=?, point_name_singular=?,
       point_name_plural=?, weekly_points_goal=?, updated_at=datetime('now') WHERE id=1`,
    [preferences.enabled ? 1 : 0, preferences.motivations_enabled ? 1 : 0, preferences.love_notes_enabled ? 1 : 0,
      preferences.weekly_challenges_enabled ? 1 : 0, preferences.points_enabled ? 1 : 0,
      systemName, singular, plural, preferences.weekly_points_goal]
  );
}

export async function savePointRules(rules: PointRule[]): Promise<void> {
  requireAndroid();
  if (rules.some((rule) => !rule.label.trim() || !Number.isInteger(rule.points) || rule.points < 0 || rule.points > 100000)) {
    throw new Error("Every action needs a label and whole-number points from 0 to 100000.");
  }
  const db = await getDb();
  await inTransaction(db, async () => {
    for (const rule of rules) {
      await db.run("UPDATE point_rules SET label=?, points=?, enabled=? WHERE action_key=?", [rule.label.trim(), rule.points, rule.enabled ? 1 : 0, rule.action_key], false);
    }
  });
}

export async function replaceRewardCatalogue(rewards: Array<Pick<RewardItem, "name" | "cost">>): Promise<void> {
  requireAndroid();
  const cleaned = rewards.map((reward) => ({ name: reward.name.trim(), cost: Number(reward.cost) }));
  if (cleaned.length > 50) throw new Error("Keep the reward catalogue to 50 items or fewer.");
  if (cleaned.some((reward) => !reward.name || !Number.isInteger(reward.cost) || reward.cost < 1 || reward.cost > 1000000)) {
    throw new Error("Every reward needs a name and a whole-number cost from 1 to 1000000.");
  }
  if (new Set(cleaned.map((reward) => reward.name.toLowerCase())).size !== cleaned.length) throw new Error("Reward names must be unique.");
  const db = await getDb();
  await inTransaction(db, async () => {
    await db.run("DELETE FROM rewards_catalogue", [], false);
    for (const [index, reward] of cleaned.entries()) {
      await db.run("INSERT INTO rewards_catalogue (id, name, cost, enabled) VALUES (?, ?, ?, 1)", [index + 1, reward.name, reward.cost], false);
    }
  });
}

export async function replaceRewardMessages(category: string, contextKey: string, texts: string[]): Promise<void> {
  requireAndroid();
  const cleaned = texts.map((text) => text.trim()).filter(Boolean);
  if (cleaned.length > 100 || cleaned.some((text) => text.length > 500)) throw new Error("Use at most 100 messages of 500 characters each in one group.");
  const db = await getDb();
  await inTransaction(db, async () => {
    await db.run("DELETE FROM reward_messages WHERE category=? AND context_key=?", [category, contextKey], false);
    for (const [index, message] of cleaned.entries()) {
      await db.run("INSERT INTO reward_messages (category, context_key, text, order_index) VALUES (?, ?, ?, ?)", [category, contextKey, message, index], false);
    }
  });
}

export async function getConfiguredLoveNote(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const db = await getDb();
  const runtime = await loadRewardRuntime(db);
  if (!runtime.preferences.enabled || !runtime.preferences.love_notes_enabled) return null;
  const pool = rewardMessagePool(runtime, "love_note");
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
