"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Gift, Heart } from "lucide-react";
import Link from "next/link";
import { claimRedemption, getHeartPoints, redeemReward } from "../db";
import type { HeartPointsBalance, Redemption, RewardItem } from "../types";

export default function HeartPointsPage() {
  const [data, setData] = useState<HeartPointsBalance | null>(null);
  const [error, setError] = useState("");
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  async function load() {
    try {
      setData(await getHeartPoints());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load heart points.");
    }
  }

  useEffect(() => { load(); }, []);

  async function redeem(reward: RewardItem) {
    if (!data || data.balance < reward.cost) return;
    setRedeeming(reward.id);
    setSuccessMsg("");
    setError("");
    try {
      await redeemReward(reward.id);
      setSuccessMsg(formatRewardMessage(data.redemption_pending_message, reward.name));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not redeem reward.");
    } finally {
      setRedeeming(null);
    }
  }

  async function claim(r: Redemption) {
    setClaiming(r.id);
    setError("");
    try {
      await claimRedemption(r.id);
      setSuccessMsg(formatRewardMessage(data?.redemption_claimed_message ?? "", r.reward));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim reward.");
    } finally {
      setClaiming(null);
    }
  }

  const pendingRedemptions = data?.redemptions.filter((r) => !r.claimed) ?? [];
  const claimedRedemptions = data?.redemptions.filter((r) => r.claimed) ?? [];

  return (
    <section className="pageStack">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Rewards</p>
          <h1>{data?.system_name ?? "Rewards"}</h1>
        </div>
        <Link className="textButton" href="/settings">Configure</Link>
      </div>

      {error && <p className="error">{error}</p>}
      {successMsg && <p className="success">{successMsg}</p>}

      {data && !data.enabled && <section className="panel disabledRewardsNotice"><Gift size={22} /><div><h2>Points and rewards are disabled</h2><p className="muted">Your existing balance and redemption history are preserved. Enable them in Settings when you want to use them again.</p></div><Link className="textButton" href="/settings">Open settings</Link></section>}

      <div className={`heartBalanceCard ${data && !data.enabled ? "featureDisabled" : ""}`}>
        <Heart size={32} className="heartBalanceIcon" />
        <div>
          <p className="metricLabel">Your balance</p>
          <strong className="heartBalanceNum">{data?.balance ?? 0}</strong>
          <small>{data?.point_name_plural ?? "points"}</small>
        </div>
      </div>

      {data?.enabled && data.weekly_goal > 0 && <section className="panel weeklyPointsGoal"><div><span className="metricLabel">This week</span><strong>{data.weekly_earned} / {data.weekly_goal} {data.point_name_plural}</strong></div><div className="progressTrack"><span style={{ width: `${Math.min(100, Math.round((data.weekly_earned / data.weekly_goal) * 100))}%` }} /></div></section>}

      {data?.enabled && pendingRedemptions.length > 0 && (
        <section className="panel pendingRewardsPanel">
          <div className="panelHeader">
            <h2>Pending rewards</h2>
            <Clock size={18} />
          </div>
          <p className="pendingRewardsHint">These are redeemed but waiting to actually happen. Hit the button once it does!</p>
          <ul className="pendingList">
            {pendingRedemptions.map((r) => (
              <li key={r.id} className="pendingItem">
                <div className="pendingItemInfo">
                  <span className="pendingItemName">{r.reward}</span>
                  <span className="pendingItemMeta">
                    <Heart size={11} /> {r.points_spent} pts &middot; redeemed {r.created_at.slice(0, 10)}
                  </span>
                </div>
                <button
                  className="claimBtn"
                  disabled={claiming === r.id}
                  onClick={() => claim(r)}
                  type="button"
                >
                  <CheckCircle2 size={15} />
                  {claiming === r.id ? "Saving…" : "It happened!"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data?.enabled && <section className="panel">
        <div className="panelHeader">
          <h2>Rewards catalogue</h2>
          <Gift size={18} />
        </div>
        <div className="rewardGrid">
          {data?.rewards.map((r) => {
            const canAfford = (data?.balance ?? 0) >= r.cost;
            return (
              <div key={r.id} className={`rewardCard ${canAfford ? "affordable" : "locked"}`}>
                <p className="rewardName">{r.name}</p>
                <p className="rewardCost">
                  <Heart size={13} />
                  {r.cost} {data.point_name_plural}
                </p>
                <button
                  className="rewardBtn"
                  disabled={!canAfford || redeeming === r.id}
                  onClick={() => redeem(r)}
                  type="button"
                >
                  {redeeming === r.id
                    ? "Redeeming…"
                    : canAfford
                    ? "Redeem"
                    : `Need ${r.cost - (data?.balance ?? 0)} more`}
                </button>
              </div>
            );
          })}
        </div>
      </section>}

      {claimedRedemptions.length > 0 && (
        <section className="panel">
          <div className="panelHeader">
            <h2>Claimed rewards</h2>
            <CheckCircle2 size={18} />
          </div>
          <ul className="heartLog">
            {claimedRedemptions.map((r) => (
              <li key={r.id} className="heartLogItem">
                <span className="heartLogSource">{r.reward}</span>
                <span className="heartLogPoints claimedTag">Claimed</span>
                <span className="heartLogDate">{(r.claimed_at ?? r.created_at).slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data?.enabled && <section className="panel">
        <div className="panelHeader">
          <h2>Recent activity</h2>
          <Clock size={18} />
        </div>
        {data?.log.length === 0 && (
          <p className="muted">No points earned yet. Log your first meal!</p>
        )}
        <ul className="heartLog">
          {data?.log.map((entry) => (
            <li key={entry.id} className="heartLogItem">
              <span className="heartLogSource">
                {entry.source}
              </span>
              <span className="heartLogPoints">+{entry.points}</span>
              <span className="heartLogDate">{entry.created_at.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      </section>}
    </section>
  );
}

function formatRewardMessage(template: string, reward: string): string {
  return template.replaceAll("{reward}", reward);
}
