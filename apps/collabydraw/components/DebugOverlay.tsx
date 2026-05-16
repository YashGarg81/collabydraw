"use client";

import React, { useEffect, useState, useRef } from "react";
import { CanvasEngine } from "@/canvas-engine/CanvasEngine";
import { Bug, Activity, Zap, Maximize, Target, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebugOverlayProps {
  engine: CanvasEngine | null;
}

export function DebugOverlay({ engine }: DebugOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [fps, setFps] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const [shapeCount, setShapeCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [memory, setMemory] = useState<number | null>(null);
  const [lastSave, setLastSave] = useState<{ status: string, size: number, time: number } | null>(null);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !engine) return;

    const measure = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastTimeRef.current = now;

        setShapeCount(engine.existingShapes.length);
        
        // Very basic memory check if supported
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perf = performance as any;
        if (perf.memory) {
          setMemory(Math.round(perf.memory.usedJSHeapSize / (1024 * 1024)));
        }

        // Diagnostics: Doc size
        const state = engine.getEncodedState();
        setLastSave(prev => ({
          status: prev?.status || "Idle",
          size: state.length,
          time: prev?.time || 0
        }));
      }

      // Hack to grab render time from the engine if we exposed it, but we can just measure here roughly
      // Actually, since we can't easily intercept clearCanvas without modifying CanvasEngine, we'll
      // just show the stats we have.
      
      rafRef.current = requestAnimationFrame(measure);
    };

    rafRef.current = requestAnimationFrame(measure);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, engine]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-black/50 hover:bg-black/80 backdrop-blur text-white/50 hover:text-white/90 p-2 rounded-lg transition-all"
        title="Open Debug Overlay"
      >
        <Bug className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-64 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl font-mono text-[10px] text-emerald-400 select-none">
      <div className="flex items-center justify-between bg-white/5 px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-white/70 font-sans font-semibold text-xs">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Engine Stats</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          ×
        </button>
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-white/50 flex items-center gap-1.5"><Zap className="w-3 h-3"/> FPS</span>
          <span className={cn("font-bold", fps >= 50 ? "text-emerald-400" : fps >= 30 ? "text-amber-400" : "text-red-400")}>
            {fps}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-white/50 flex items-center gap-1.5"><Target className="w-3 h-3"/> Shapes (Total)</span>
          <span>{shapeCount}</span>
        </div>

        {memory !== null && (
          <div className="flex justify-between items-center">
            <span className="text-white/50 flex items-center gap-1.5"><Maximize className="w-3 h-3"/> Memory (Heap)</span>
            <span>{memory} MB</span>
          </div>
        )}

        {lastSave && (
          <div className="flex justify-between items-center">
            <span className="text-white/50 flex items-center gap-1.5"><Save className="w-3 h-3"/> Doc Size (Binary)</span>
            <span>{(lastSave.size / 1024).toFixed(1)} KB</span>
          </div>
        )}
      </div>

      <div className="bg-white/5 px-3 py-2 border-t border-white/10 text-white/30 text-[9px] leading-relaxed">
        Performance mode active. Virtualization & Spatial Indexing enabled.
      </div>
    </div>
  );
}
