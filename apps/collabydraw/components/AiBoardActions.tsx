"use client";

/**
 * Phase 3C: AI Board Actions Panel
 * Auto-layout, Cluster by type, Summarize board
 */

import React, { useState, useCallback } from "react";
import { LayoutGrid, Layers, FileText, Loader2, CheckCircle2, AlertCircle, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CanvasEngine } from "@/canvas-engine/CanvasEngine";

interface AiBoardActionsProps {
  engine: CanvasEngine | null;
}

type ActionId = "layout" | "cluster" | "summarize";
type Status = "idle" | "loading" | "success" | "error";

const ACTIONS: { id: ActionId; label: string; desc: string; icon: React.ReactNode; credit: boolean }[] = [
  {
    id: "layout",
    label: "Auto-layout",
    desc: "Arrange all shapes in a clean grid",
    icon: <LayoutGrid className="w-3.5 h-3.5" />,
    credit: false,
  },
  {
    id: "cluster",
    label: "Cluster by type",
    desc: "Group similar shapes into zones",
    icon: <Layers className="w-3.5 h-3.5" />,
    credit: false,
  },
  {
    id: "summarize",
    label: "Summarize board",
    desc: "AI reads canvas → adds summary sticky note",
    icon: <FileText className="w-3.5 h-3.5" />,
    credit: true,
  },
];

export function AiBoardActions({ engine }: AiBoardActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);

  const run = useCallback(async (action: ActionId) => {
    if (!engine) { setStatus("error"); setStatusMsg("Canvas not ready."); return; }
    const shapes = engine.getShapes();
    if (shapes.length === 0) { setStatus("error"); setStatusMsg("Canvas is empty — add some shapes first."); return; }

    setActiveAction(action);
    setStatus("loading");
    setStatusMsg(
      action === "layout" ? "Computing layout…"
      : action === "cluster" ? "Clustering shapes…"
      : "Asking AI to summarize…"
    );

    try {
      const res = await fetch("/api/ai/manipulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, shapes }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Request failed");

      if (action === "layout" || action === "cluster") {
        const updated = data.shapes;
        if (!Array.isArray(updated)) throw new Error("Invalid response from server.");
        engine.applyLayout(updated);
        setStatus("success");
        setStatusMsg(`Applied ${action === "layout" ? "grid layout" : "cluster grouping"} to ${updated.length} shapes.`);
      } else {
        // summarize — add sticky note to canvas
        const note = data.stickyNote;
        if (!note) throw new Error("AI did not return a summary.");
        engine.addShapes([note]);
        setStatus("success");
        setStatusMsg("Summary added as a sticky note!");
      }

      setTimeout(() => { setStatus("idle"); setStatusMsg(""); setActiveAction(null); }, 3500);
    } catch (err) {
      console.error("AI board action error:", err);
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Action failed. Try again.");
      setTimeout(() => { setStatus("idle"); setStatusMsg(""); setActiveAction(null); }, 4000);
    }
  }, [engine]);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(p => !p)}
        title="AI Board Actions"
        className={cn(
          "flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-all select-none",
          isOpen
            ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
            : "bg-[#232329] border-white/10 text-white/60 hover:bg-[#31303b] hover:text-white/80"
        )}
      >
        <Sparkles className="w-3 h-3" />
        <span className="hidden sm:inline">AI Actions</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-10 left-0 z-50 w-72 rounded-2xl border border-white/10 bg-[#13131a]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-1 pb-1">
            AI Board Actions
          </p>

          {ACTIONS.map(a => (
            <button
              key={a.id}
              onClick={() => run(a.id)}
              disabled={status === "loading"}
              className={cn(
                "w-full flex items-start gap-3 p-2.5 rounded-xl border transition-all text-left",
                "border-white/5 bg-white/3 hover:bg-white/6 hover:border-white/10",
                status === "loading" && activeAction === a.id && "border-violet-500/30 bg-violet-500/5",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <span className={cn(
                "mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                a.id === "layout"    && "bg-blue-500/15 text-blue-400",
                a.id === "cluster"   && "bg-emerald-500/15 text-emerald-400",
                a.id === "summarize" && "bg-violet-500/15 text-violet-400",
              )}>
                {status === "loading" && activeAction === a.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : a.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/80">{a.label}</span>
                  {a.credit && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-violet-500/30 text-violet-400/70 bg-violet-500/10">
                      1 credit
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-white/35 mt-0.5 block">{a.desc}</span>
              </span>
            </button>
          ))}

          {/* Status feedback */}
          {statusMsg && (
            <div className={cn(
              "flex items-start gap-2 p-2.5 rounded-xl text-xs border",
              status === "success" && "bg-emerald-500/8 border-emerald-500/20 text-emerald-400",
              status === "error"   && "bg-red-500/8 border-red-500/20 text-red-400",
              status === "loading" && "bg-violet-500/8 border-violet-500/20 text-violet-400",
            )}>
              {status === "success" && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              {status === "error"   && <AlertCircle  className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              {status === "loading" && <Loader2      className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 animate-spin" />}
              <span>{statusMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
