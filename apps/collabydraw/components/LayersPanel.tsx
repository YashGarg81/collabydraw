"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Layers, Plus, Trash2, GripVertical, Eye, EyeOff, Lock, Unlock, Check, Edit2, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CanvasEngine } from "@/canvas-engine/CanvasEngine";
import { Layer } from "@/canvas-engine/LayerManager";

interface LayersPanelProps {
  engine: CanvasEngine | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LayersPanel({ engine, isOpen, onClose }: LayersPanelProps) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with engine
  const refresh = useCallback(() => {
    if (!engine) return;
    // Layers come out sorted by their string order ascending (bottom to top visually on canvas)
    // We reverse it so "top" layers are at the top of the UI list
    const engineLayers = engine.getLayers();
    setLayers([...engineLayers].reverse());
  }, [engine]);

  useEffect(() => {
    if (!engine || !isOpen) return;
    refresh();
    engine.setLayerChangeCallback(() => refresh());
    return () => {
      engine.setLayerChangeCallback(() => {});
    };
  }, [engine, isOpen, refresh]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  if (!isOpen) return null;

  // ── Actions ────────────────────────────────────────────────────────

  const handleCreateLayer = () => {
    if (!engine) return;
    engine.createLayer(`Layer ${layers.length + 1}`);
  };

  const handleDeleteLayer = (id: string) => {
    if (!engine || id === "default") return;
    if (confirm("Are you sure you want to delete this layer? Shapes will be moved to the default layer.")) {
      engine.deleteLayer(id);
    }
  };

  const handleToggleVisible = (id: string) => {
    engine?.toggleLayerVisibility(id);
  };

  const handleToggleLock = (id: string) => {
    engine?.toggleLayerLock(id);
  };

  const startRename = (layer: Layer) => {
    setEditingId(layer.id);
    setEditName(layer.name);
  };

  const commitRename = () => {
    if (!engine || !editingId) return;
    if (editName.trim()) {
      engine.renameLayer(editingId, editName.trim());
    }
    setEditingId(null);
  };

  // ── Drag & Drop ────────────────────────────────────────────────────

  const handleDragStart = (i: number) => {
    setDragIdx(i);
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setOverIdx(i);
  };

  const handleDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i || !engine) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...layers];
    const [item] = reordered.splice(dragIdx, 1);
    reordered.splice(i, 0, item);
    
    // Reverse again back to engine format (bottom to top)
    const newOrderIds = [...reordered].reverse().map(l => l.id);
    engine.reorderLayers(newOrderIds);
    
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div
      className="fixed right-0 top-0 h-full w-72 z-40 flex flex-col
                 bg-[#0d0d14]/98 backdrop-blur-2xl border-l border-white/8
                 shadow-2xl shadow-black/60 animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2 text-white/80">
          <Layers className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold tracking-wide">Layers</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreateLayer}
            className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/50 hover:text-white transition-all"
            title="New Layer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/30 hover:text-white/70 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto py-2 px-1 space-y-1">
        {layers.map((layer, i) => {
          const isDefault = layer.id === "default";
          const isDragged = dragIdx === i;
          const isOver = overIdx === i;

          return (
            <div
              key={layer.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              className={cn(
                "group relative flex items-center gap-2 px-2 py-2 mx-1 rounded-lg cursor-grab transition-all select-none border border-transparent",
                isDragged && "opacity-30",
                isOver && "bg-violet-500/10 border-violet-500/30",
                !isDragged && !isOver && "hover:bg-white/4",
                !layer.visible && "opacity-50 grayscale"
              )}
            >
              {/* Drag Handle */}
              <GripVertical className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 shrink-0" />

              {/* Editing vs Display */}
              {editingId === layer.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    ref={inputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={commitRename}
                    className="flex-1 bg-black/50 border border-violet-500/50 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-violet-400"
                  />
                  <button onClick={commitRename} className="text-emerald-400 hover:text-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div 
                  className="flex-1 min-w-0 text-[12px] text-white/80 truncate flex items-center gap-2"
                  onDoubleClick={() => startRename(layer)}
                >
                  <span className={cn(isDefault && "font-semibold text-white")}>
                    {layer.name}
                  </span>
                  {isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">Base</span>}
                  <button 
                    onClick={() => startRename(layer)}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/80 transition-opacity"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(layer.id); }}
                  className={cn(
                    "w-6 h-6 rounded flex items-center justify-center transition-all",
                    layer.locked ? "text-amber-400 opacity-100" : "text-white/40 hover:text-white hover:bg-white/10"
                  )}
                  title={layer.locked ? "Unlock" : "Lock"}
                >
                  {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisible(layer.id); }}
                  className={cn(
                    "w-6 h-6 rounded flex items-center justify-center transition-all",
                    !layer.visible ? "text-white/40" : "text-white/40 hover:text-white hover:bg-white/10"
                  )}
                  title={layer.visible ? "Hide" : "Show"}
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                {!isDefault && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title="Delete Layer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/8 px-4 py-3 shrink-0 bg-white/[0.02]">
        <p className="text-[10px] text-white/30 text-center leading-relaxed">
          Drag to reorder • Double-click to rename<br/>
          Hidden layers are ignored during export
        </p>
      </div>
    </div>
  );
}
