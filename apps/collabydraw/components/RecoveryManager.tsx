"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, RotateCcw, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecoveryManagerProps {
  boardId: string | null;
  localVersion: string | null; // Base64 encoded update
  localTimestamp: number;
  serverTimestamp: number;
  onRecover: (data: string) => void;
  onDiscard: () => void;
}

export function RecoveryManager({
  boardId,
  localVersion,
  localTimestamp,
  serverTimestamp,
  onRecover,
  onDiscard
}: RecoveryManagerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show if local is newer by more than 5 seconds
    if (boardId && localVersion && localTimestamp > serverTimestamp + 5000) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [boardId, localVersion, localTimestamp, serverTimestamp]);

  if (!visible) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-[#1e1e24] border border-violet-500/30 rounded-xl shadow-2xl shadow-black/80 px-4 py-3 flex items-center gap-4 min-w-[400px]">
        <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-violet-400" />
        </div>
        
        <div className="flex-1">
          <h4 className="text-xs font-bold text-white mb-0.5">Unsaved Local Changes Found</h4>
          <p className="text-[10px] text-white/50 leading-tight">
            Your browser has a more recent version of this board than the server. 
            Would you like to restore it?
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            Discard
          </button>
          <button
            onClick={() => {
                if (localVersion) onRecover(localVersion);
                setVisible(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-[10px] font-bold text-white shadow-lg shadow-violet-600/20 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Restore
          </button>
        </div>

        <button 
          onClick={() => setVisible(false)}
          className="p-1 rounded-md text-white/20 hover:text-white/50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
