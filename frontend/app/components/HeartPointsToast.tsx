"use client";

import { useEffect } from "react";

export function HeartPointsToast({ points, onDismiss }: { points: number; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="heartToast" onClick={onDismiss} role="status">
      <span className="heartToastBurst" aria-hidden="true">
        💗
      </span>
      <span className="heartToastText">+{points} heart {points === 1 ? "point" : "points"} earned!</span>
    </div>
  );
}
