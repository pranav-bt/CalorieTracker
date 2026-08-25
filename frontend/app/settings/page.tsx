"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gift, MessageSquareText, Plus, Save, Settings, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  getRewardConfiguration, replaceRewardCatalogue, replaceRewardMessages,
  savePointRules, saveRewardPreferences,
} from "../db/rewards";
import type { PointRule, RewardConfiguration, RewardItem, RewardPreferences } from "../types";

const MESSAGE_GROUPS = [
  ...["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((label, index) => ({ label: `${label} greeting`, category: "day_greeting", context: String(index) })),
  { label: "Daily motivations", category: "affirmation", context: "" },
  { label: "Love notes", category: "love_note", context: "" },
  { label: "On-target day messages", category: "end_of_day_good", context: "" },
  { label: "Tough-day messages", category: "end_of_day_tough", context: "" },
  { label: "Weekly report: on track", category: "weekly_report_great", context: "" },
  { label: "Weekly report: close", category: "weekly_report_ok", context: "" },
  { label: "Weekly report: tough", category: "weekly_report_tough", context: "" },
  { label: "Weekly challenges", category: "weekly_challenge", context: "" },
  { label: "Challenge completed messages", category: "challenge_completed", context: "" },
  { label: "Reward redeemed messages", category: "redemption_pending", context: "" },
  { label: "Reward completed messages", category: "redemption_claimed", context: "" },
  { label: "First meal messages", category: "milestone", context: "first_meal_today" },
  { label: "Daily goal messages", category: "milestone", context: "goal_hit" },
  { label: "7-day streak messages", category: "milestone", context: "streak_7" },
  { label: "30-day streak messages", category: "milestone", context: "streak_30" },
] as const;

type RewardDraft = Pick<RewardItem, "name" | "cost">;

export default function SettingsPage() {
  const [config, setConfig] = useState<RewardConfiguration | null>(null);
  const [preferences, setPreferences] = useState<RewardPreferences | null>(null);
  const [rules, setRules] = useState<PointRule[]>([]);
  const [rewards, setRewards] = useState<RewardDraft[]>([]);
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [messageText, setMessageText] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const loaded = await getRewardConfiguration();
    setConfig(loaded); setPreferences(loaded.preferences); setRules(loaded.point_rules);
    setRewards(loaded.rewards.map(({ name, cost }) => ({ name, cost })));
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load settings.")); }, []);
  const group = MESSAGE_GROUPS[selectedGroup];
  const groupMessages = useMemo(() => config?.messages.filter((item) => item.category === group.category && item.context_key === group.context).map((item) => item.text) ?? [], [config, group]);
  useEffect(() => { setMessageText(groupMessages.join("\n")); }, [groupMessages]);

  function notice(text: string) { setMessage(text); setError(""); }
  function fail(caught: unknown, fallback: string) { setError(caught instanceof Error ? caught.message : fallback); setMessage(""); }

  async function savePreferences() {
    if (!preferences) return;
    setBusy("preferences");
    try { await saveRewardPreferences(preferences); setConfig((current) => current ? { ...current, preferences } : current); notice("Reward feature settings saved."); }
    catch (caught) { fail(caught, "Could not save reward settings."); }
    finally { setBusy(""); }
  }

  async function saveRules() {
    setBusy("rules");
    try { await savePointRules(rules); setConfig((current) => current ? { ...current, point_rules: rules } : current); notice("Point actions saved."); }
    catch (caught) { fail(caught, "Could not save point actions."); }
    finally { setBusy(""); }
  }

  async function saveRewards() {
    setBusy("rewards");
    try { await replaceRewardCatalogue(rewards); setConfig((current) => current ? { ...current, rewards: rewards.map((reward, index) => ({ id: index + 1, ...reward })) } : current); notice("Reward catalogue saved."); }
    catch (caught) { fail(caught, "Could not save rewards."); }
    finally { setBusy(""); }
  }

  async function saveMessages() {
    setBusy("messages");
    try {
      await replaceRewardMessages(group.category, group.context, messageText.split("\n"));
      const cleaned = messageText.split("\n").map((text) => text.trim()).filter(Boolean);
      setConfig((current) => current ? { ...current, messages: [
        ...current.messages.filter((item) => item.category !== group.category || item.context_key !== group.context),
        ...cleaned.map((text, index) => ({ id: -(index + 1), category: group.category, context_key: group.context, text, order_index: index })),
      ] } : current);
      notice(`${group.label} saved.`);
    } catch (caught) { fail(caught, "Could not save messages."); }
    finally { setBusy(""); }
  }

  return <section className="pageStack">
    <div className="pageHeader"><div><p className="eyebrow">On-device configuration</p><h1>Settings</h1></div><Link className="textButton" href="/goals"><SlidersHorizontal size={17} />Calorie goals</Link></div>
    <p className="pageIntro">Everything below stays on this phone and is included in local backups. Disabling the system hides prompts and stops new points without deleting balances or redemption history.</p>
    {message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}

    {preferences && <section className="panel rewardSettingsSection">
      <div className="panelHeader"><div><h2>Feature controls</h2><p className="muted compactText">The master switch overrides every feature below.</p></div><Settings size={19} /></div>
      <label className="masterFeatureToggle"><span><strong>Rewards and motivation</strong><small>{preferences.enabled ? "Enabled" : "Completely disabled"}</small></span><input aria-label="Enable rewards and motivation" checked={preferences.enabled} onChange={(event) => setPreferences({ ...preferences, enabled: event.target.checked })} type="checkbox" /></label>
      <div className="settingsToggleGrid">
        <Toggle label="Dashboard motivations" checked={preferences.motivations_enabled} onChange={(value) => setPreferences({ ...preferences, motivations_enabled: value })} />
        <Toggle label="Timed love notes" checked={preferences.love_notes_enabled} onChange={(value) => setPreferences({ ...preferences, love_notes_enabled: value })} />
        <Toggle label="Weekly challenges" checked={preferences.weekly_challenges_enabled} onChange={(value) => setPreferences({ ...preferences, weekly_challenges_enabled: value })} />
        <Toggle label="Points and redemption" checked={preferences.points_enabled} onChange={(value) => setPreferences({ ...preferences, points_enabled: value })} />
      </div>
      <div className="profileGrid">
        <Field label="Section name"><input value={preferences.system_name} onChange={(event) => setPreferences({ ...preferences, system_name: event.target.value })} /></Field>
        <Field label="One point is called"><input value={preferences.point_name_singular} onChange={(event) => setPreferences({ ...preferences, point_name_singular: event.target.value })} /></Field>
        <Field label="Multiple points are called"><input value={preferences.point_name_plural} onChange={(event) => setPreferences({ ...preferences, point_name_plural: event.target.value })} /></Field>
        <Field label="Weekly points goal"><input min="0" max="100000" type="number" value={preferences.weekly_points_goal} onChange={(event) => setPreferences({ ...preferences, weekly_points_goal: Number(event.target.value) })} /></Field>
      </div>
      <button disabled={Boolean(busy)} onClick={savePreferences} type="button"><Save size={17} />{busy === "preferences" ? "Saving…" : "Save feature settings"}</button>
    </section>}

    <section className="panel rewardSettingsSection">
      <div className="panelHeader"><div><h2>Points for actions</h2><p className="muted compactText">Only actions the app can detect are listed. Set an action to zero or switch it off.</p></div><SlidersHorizontal size={19} /></div>
      <div className="pointRuleList">{rules.map((rule, index) => <div className="pointRuleRow" key={rule.action_key}>
        <input aria-label={`${rule.action_key} label`} value={rule.label} onChange={(event) => setRules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
        <input aria-label={`${rule.action_key} points`} min="0" max="100000" type="number" value={rule.points} onChange={(event) => setRules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, points: Number(event.target.value) } : item))} />
        <label><input aria-label={`Enable ${rule.action_key}`} checked={rule.enabled} onChange={(event) => setRules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} type="checkbox" />Active</label>
      </div>)}</div>
      <button disabled={Boolean(busy) || rules.length === 0} onClick={saveRules} type="button"><Save size={17} />{busy === "rules" ? "Saving…" : "Save point actions"}</button>
    </section>

    <section className="panel rewardSettingsSection">
      <div className="panelHeader"><div><h2>Reward catalogue</h2><p className="muted compactText">Past redemptions keep their original name and cost.</p></div><Gift size={19} /></div>
      <div className="catalogueEditor">{rewards.map((reward, index) => <div className="catalogueEditorRow" key={index}>
        <input aria-label={`Reward ${index + 1} name`} placeholder="Reward name" value={reward.name} onChange={(event) => setRewards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
        <input aria-label={`Reward ${index + 1} cost`} min="1" max="1000000" placeholder="Cost" type="number" value={reward.cost} onChange={(event) => setRewards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cost: Number(event.target.value) } : item))} />
        <button aria-label={`Delete reward ${index + 1}`} className="iconButton danger" onClick={() => setRewards((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 size={16} /></button>
      </div>)}</div>
      <div className="actionRow"><button className="secondaryButton" onClick={() => setRewards((current) => [...current, { name: "", cost: 10 }])} type="button"><Plus size={17} />Add reward</button><button disabled={Boolean(busy)} onClick={saveRewards} type="button"><Save size={17} />{busy === "rewards" ? "Saving…" : "Save catalogue"}</button></div>
    </section>

    <section className="panel rewardSettingsSection">
      <div className="panelHeader"><div><h2>Prompts and motivation text</h2><p className="muted compactText">Enter one message per line. Empty lines are ignored; an empty group shows nothing.</p></div><MessageSquareText size={19} /></div>
      <label className="stackedField"><span>Text group</span><select value={selectedGroup} onChange={(event) => setSelectedGroup(Number(event.target.value))}>{MESSAGE_GROUPS.map((item, index) => <option key={`${item.category}-${item.context}`} value={index}>{item.label}</option>)}</select></label>
      <label className="stackedField"><span>{group.label}</span><textarea className="messagePoolEditor" aria-label="Messages, one per line" value={messageText} onChange={(event) => setMessageText(event.target.value)} /></label>
      <button disabled={Boolean(busy)} onClick={saveMessages} type="button"><Save size={17} />{busy === "messages" ? "Saving…" : "Save this text group"}</button>
    </section>
  </section>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label><span>{label}</span><input aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="stackedField"><span>{label}</span>{children}</label>;
}
