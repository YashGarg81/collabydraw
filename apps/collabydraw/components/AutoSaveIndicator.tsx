"use client";

import { useEffect, useState } from "react";
import { Check, CloudOff, Loader2 } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt: Date | null;
}

function useRelativeTime(date: Date | null) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    function update() {
      if (!date) { setLabel(""); return; }
      const diff = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diff < 5) setLabel("just now");
      else if (diff < 60) setLabel(`${diff}s ago`);
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m ago`);
      else setLabel(`${Math.floor(diff / 3600)}h ago`);
    }
    update();
    const t = setInterval(update, 5000);
    return () => clearInterval(t);
  }, [date]);

  return label;
}

export function AutoSaveIndicator({ status, lastSavedAt }: AutoSaveIndicatorProps) {
  const relTime = useRelativeTime(status === "saved" ? lastSavedAt : null);

  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium select-none">
      {status === "saving" && (
        <>
          <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
          <span className="text-white/40">Saving…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-white/35">Saved {relTime}</span>
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="w-3 h-3 text-red-400" />
          <span className="text-red-400/70">Save failed</span>
        </>
      )}
    </div>
  );
}
