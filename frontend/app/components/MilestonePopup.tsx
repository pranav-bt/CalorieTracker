"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function MilestonePopup({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="loveNoteOverlay" onClick={onDismiss}>
      <div className="milestoneCard" onClick={(e) => e.stopPropagation()}>
        <button className="loveNoteClose" onClick={onDismiss} aria-label="Close">
          <X size={18} />
        </button>
        <p className="milestoneIcon">🎉</p>
        <p className="milestoneText">{message}</p>
      </div>
    </div>
  );
}
