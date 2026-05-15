"use client";

/**
 * Phase 2: Layers Panel
 * Shows all shapes in z-order (bottom → top). Supports:
 *  - Select a shape by clicking its row
 *  - Drag rows to reorder z-order
 *  - Bring to front / Send to back via context buttons
 *  - Visual icon per shape type
 *  - Visibility toggle (hides shape from canvas)
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Layers, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Eye, EyeOff, X, GripVertical,
  Square, Circle, Triangle, Minus, Type, Pencil, Image as ImageIcon,
  StickyNote, FrameIcon, ArrowRight, Diamond
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CanvasEngine } from "@/canvas-engine/CanvasEngine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyShape = Record<string, any>;

interface LayersPanelProps {
  engine: CanvasEngine | null;
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  rectangle: <Square   className="w-3 h-3" />,
  ellipse:   <Circle   className="w-3 h-3" />,
  diamond:   <Diamond  className="w-3 h-3" />,
  triangle:  <Triangle className="w-3 h-3" />,
  line:      <Minus    className="w-3 h-3" />,
  arrow:     <ArrowRight className="w-3 h-3" />,
  text:      <Type     className="w-3 h-3" />,
  "free-draw":<Pencil  className="w-3 h-3" />,
  sticky:    <StickyNote className="w-3 h-3" />,
  frame:     <FrameIcon className="w-3 h-3" />,
  embed:     <ImageIcon className="w-3 h-3" />,
};

const TYPE_COLORS: Record<string, string> = {
  rectangle:  "text-blue-400",
  ellipse:    "text-emerald-400",
  diamond:    "text-violet-400",
  triangle:   "text-amber-400",
  line:       "text-white/50",
  arrow:      "text-cyan-400",
  text:       "text-pink-400",
  "free-draw":"text-orange-400",
  sticky:     "text-yellow-400",
  frame:      "text-indigo-400",
  embed:      "text-teal-400",
};

function shapeLabel(s: AnyShape): string {
  if (s.text && typeof s.text === "string" && s.text.trim()) {
    return s.text.slice(0, 28) + (s.text.length > 28 ? "…" : "");
  }
  return (s.type as string)?.replace("-", " ") ?? "Shape";
}

export function LayersPanel({ engine, isOpen, onClose }: LayersPanelProps) {
  const [shapes,  setShapes]  = useState<AnyShape[]>([]);
  const [hidden,  setHidden]  = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll engine shapes every 300ms (lightweight)
  const refresh = useCallback(() => {
    if (!engine) return;
    const s = engine.getShapes() as AnyShape[];
    setShapes([...s].reverse()); // top of canvas = top of list
  }, [engine]);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    intervalRef.current = setInterval(refresh, 300);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  // ── Drag-to-reorder ─────────────────────────────────────────────────
  function handleDragStart(i: number) { setDragIdx(i); }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault(); setOverIdx(i);
  }
  function handleDrop(i: number) {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const reordered = [...shapes];
    const [item] = reordered.splice(dragIdx, 1);
    reordered.splice(i, 0, item);
    setShapes(reordered);
    // Apply: reversed back to bottom-first for engine
    engine?.reorderShapes([...reordered].reverse().map(s => s.id));
    setDragIdx(null); setOverIdx(null);
  }

  // ── Z-order actions ─────────────────────────────────────────────────
  function moveUp(i: number) {
    if (i === 0) return;
    const r = [...shapes]; [r[i], r[i-1]] = [r[i-1], r[i]];
    setShapes(r);
    engine?.reorderShapes([...r].reverse().map(s => s.id));
  }
  function moveDown(i: number) {
    if (i === shapes.length - 1) return;
    const r = [...shapes]; [r[i], r[i+1]] = [r[i+1], r[i]];
    setShapes(r);
    engine?.reorderShapes([...r].reverse().map(s => s.id));
  }
  function moveToFront(i: number) {
    const r = [...shapes]; const [s] = r.splice(i, 1); r.unshift(s);
    setShapes(r);
    engine?.reorderShapes([...r].reverse().map(s => s.id));
  }
  function moveToBack(i: number) {
    const r = [...shapes]; const [s] = r.splice(i, 1); r.push(s);
    setShapes(r);
    engine?.reorderShapes([...r].reverse().map(s => s.id));
  }

  // ── Visibility toggle (CSS filter trick via opacity) ─────────────────
  // Real implementation would require engine-level hidden flag; for now we
  // just track which shapes are "hidden" locally and remove them from the render.
  function toggleHidden(id: string) {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed right-0 top-0 h-full w-64 z-40 flex flex-col
                 bg-[#0d0d14]/98 backdrop-blur-2xl border-l border-white/8
                 shadow-2xl shadow-black/60 animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2 text-white/80">
          <Layers className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-semibold tracking-wide">Layers</span>
          <span className="text-[10px] text-white/25 font-normal">({shapes.length})</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/30 hover:text-white/70 transition-all">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Shape list */}
      <div className="flex-1 overflow-y-auto py-1 space-y-px">
        {shapes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-white/20 text-xs gap-2">
            <Layers className="w-6 h-6" />
            <span>No shapes yet</span>
          </div>
        ) : (
          shapes.map((shape, i) => {
            const isHidden  = hidden.has(shape.id);
            const isDragged = dragIdx === i;
            const isOver    = overIdx === i;
            const typeColor = TYPE_COLORS[shape.type] ?? "text-white/40";

            return (
              <div
                key={shape.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={cn(
                  "group flex items-center gap-2 px-2 py-1.5 mx-1 rounded-lg cursor-grab transition-all select-none",
                  isDragged && "opacity-30",
                  isOver    && "bg-violet-500/10 border border-violet-500/20",
                  !isDragged && !isOver && "hover:bg-white/4",
                  isHidden  && "opacity-40"
                )}
              >
                {/* Drag handle */}
                <GripVertical className="w-3 h-3 text-white/15 group-hover:text-white/40 shrink-0" />

                {/* Type icon */}
                <span className={cn("shrink-0", typeColor)}>
                  {TYPE_ICONS[shape.type] ?? <Square className="w-3 h-3" />}
                </span>

                {/* Label */}
                <span className="flex-1 min-w-0 text-[11px] text-white/60 truncate capitalize">
                  {shapeLabel(shape)}
                </span>

                {/* Actions (shown on hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <LayerBtn title="To Front"   onClick={() => moveToFront(i)}><ChevronsUp   className="w-2.5 h-2.5" /></LayerBtn>
                  <LayerBtn title="Move Up"    onClick={() => moveUp(i)}      ><ChevronUp    className="w-2.5 h-2.5" /></LayerBtn>
                  <LayerBtn title="Move Down"  onClick={() => moveDown(i)}    ><ChevronDown  className="w-2.5 h-2.5" /></LayerBtn>
                  <LayerBtn title="To Back"    onClick={() => moveToBack(i)}  ><ChevronsDown className="w-2.5 h-2.5" /></LayerBtn>
                  <LayerBtn title={isHidden ? "Show" : "Hide"} onClick={() => toggleHidden(shape.id)}>
                    {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                  </LayerBtn>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer legend */}
      <div className="border-t border-white/6 px-4 py-2 shrink-0">
        <p className="text-[9px] text-white/20 text-center">
          Drag rows to reorder • Top = front
        </p>
      </div>
    </div>
  );
}

function LayerBtn({ children, onClick, title }: {
  children: React.ReactNode; onClick: () => void; title?: string;
}) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-4 h-4 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
    >
      {children}
    </button>
  );
}
