"use client";

import { X } from "lucide-react";

export function LoveNotePopup({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="loveNoteOverlay" onClick={onDismiss}>
      <div className="loveNoteCard" onClick={(e) => e.stopPropagation()}>
        <button className="loveNoteClose" onClick={onDismiss} aria-label="Close">
          <X size={18} />
        </button>
        <p className="loveNoteHeart">💚</p>
        <p className="loveNoteText">{message}</p>
      </div>
    </div>
  );
}
