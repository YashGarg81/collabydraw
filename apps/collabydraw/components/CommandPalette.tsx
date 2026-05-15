"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Command, Square, Circle, Diamond, ArrowRight,
  Minus, PenTool, Eraser, Type, StickyNote, Image,
  Scan, Lasso, Frame, Globe, Hand, MousePointer,
  Undo2, Redo2, Download, Trash2, ZoomIn,
  ZoomOut, Grid3x3, Cpu, ChevronRight, Clock
} from "lucide-react";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()) ||
          (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : commands;

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    (acc[cmd.category] = acc[cmd.category] || []).push(cmd);
    return acc;
  }, {});

  // Flat list for keyboard nav
  const flat = Object.values(grouped).flat();

  const runSelected = useCallback(() => {
    const item = flat[selected];
    if (item) {
      item.action();
      onClose();
    }
  }, [flat, selected, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); runSelected(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flat, runSelected, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  let flatIndex = 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[18%] left-1/2 -translate-x-1/2 z-[9999] w-full max-w-xl"
          >
            <div className="rounded-2xl border border-white/10 bg-[#13131a]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
                <Search className="w-4 h-4 text-white/30 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search tools, actions…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                  className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 focus:outline-none"
                />
                <kbd className="text-[10px] text-white/25 border border-white/10 rounded px-1.5 py-0.5 font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-80 overflow-y-auto custom-scrollbar py-2">
                {flat.length === 0 ? (
                  <div className="py-10 text-center text-sm text-white/30">
                    No results for &quot;{query}&quot;
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="mb-1">
                      <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                        {category}
                      </div>
                      {items.map((item) => {
                        const idx = flatIndex++;
                        const isSelected = idx === selected;
                        return (
                          <button
                            key={item.id}
                            data-index={idx}
                            onMouseEnter={() => setSelected(idx)}
                            onClick={() => { item.action(); onClose(); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                              isSelected ? "bg-violet-600/20 text-white" : "text-white/70 hover:text-white"
                            }`}
                          >
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                              isSelected ? "bg-violet-600/30 text-violet-300" : "bg-white/5 text-white/40"
                            }`}>
                              {item.icon}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-medium truncate">{item.label}</span>
                              {item.description && (
                                <span className="block text-xs text-white/35 truncate">{item.description}</span>
                              )}
                            </span>
                            {item.shortcut && (
                              <kbd className="shrink-0 text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5 font-mono">
                                {item.shortcut}
                              </kbd>
                            )}
                            {isSelected && <ChevronRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/6 text-[10px] text-white/25">
                <span className="flex items-center gap-1">
                  <kbd className="border border-white/10 rounded px-1 font-mono">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="border border-white/10 rounded px-1 font-mono">↵</kbd> select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="border border-white/10 rounded px-1 font-mono">esc</kbd> close
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Command className="w-2.5 h-2.5" /> K
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Factory: build the default command list ──────────────────────────────────

export function buildCommands(opts: {
  setTool: (t: string) => void;
  undo: () => void;
  redo: () => void;
  exportPNG: () => void;
  clearCanvas: () => void;
  setScale: (s: number) => void;
  toggleGrid: () => void;
  openShortcuts: () => void;
  openAI: () => void;
}): CommandItem[] {
  const { setTool, undo, redo, exportPNG, clearCanvas, setScale, toggleGrid, openShortcuts, openAI } = opts;
  return [
    // Tools
    { id: "tool-select", label: "Selection", description: "Select and move shapes", icon: <MousePointer className="w-3.5 h-3.5" />, shortcut: "1", category: "Tools", action: () => setTool("selection") },
    { id: "tool-grab", label: "Hand / Pan", description: "Pan the canvas", icon: <Hand className="w-3.5 h-3.5" />, shortcut: "2", category: "Tools", action: () => setTool("grab") },
    { id: "tool-rect", label: "Rectangle", description: "Draw a rectangle", icon: <Square className="w-3.5 h-3.5" />, shortcut: "3", category: "Tools", action: () => setTool("rectangle") },
    { id: "tool-ellipse", label: "Ellipse", description: "Draw an ellipse or circle", icon: <Circle className="w-3.5 h-3.5" />, shortcut: "4", category: "Tools", action: () => setTool("ellipse") },
    { id: "tool-diamond", label: "Diamond", description: "Draw a diamond shape", icon: <Diamond className="w-3.5 h-3.5" />, shortcut: "5", category: "Tools", action: () => setTool("diamond") },
    { id: "tool-line", label: "Line", description: "Draw a straight line", icon: <Minus className="w-3.5 h-3.5" />, shortcut: "6", category: "Tools", action: () => setTool("line") },
    { id: "tool-freedraw", label: "Free Draw", description: "Freehand drawing", icon: <PenTool className="w-3.5 h-3.5" />, shortcut: "7", category: "Tools", action: () => setTool("free-draw") },
    { id: "tool-arrow", label: "Arrow", description: "Draw an arrow", icon: <ArrowRight className="w-3.5 h-3.5" />, shortcut: "8", category: "Tools", action: () => setTool("arrow") },
    { id: "tool-text", label: "Text", description: "Add text", icon: <Type className="w-3.5 h-3.5" />, shortcut: "9", category: "Tools", action: () => setTool("text") },
    { id: "tool-eraser", label: "Eraser", description: "Erase shapes", icon: <Eraser className="w-3.5 h-3.5" />, shortcut: "0", category: "Tools", action: () => setTool("eraser") },
    { id: "tool-sticky", label: "Sticky Note", description: "Add a sticky note", icon: <StickyNote className="w-3.5 h-3.5" />, shortcut: "S", category: "Tools", action: () => setTool("sticky") },
    { id: "tool-image", label: "Image", description: "Insert an image", icon: <Image className="w-3.5 h-3.5" aria-label="Image tool" />, shortcut: "I", category: "Tools", action: () => setTool("image") },
    { id: "tool-laser", label: "Laser Pointer", description: "Highlight with laser", icon: <Scan className="w-3.5 h-3.5" />, shortcut: "K", category: "Tools", action: () => setTool("laser") },
    { id: "tool-lasso", label: "Lasso Select", description: "Freeform selection", icon: <Lasso className="w-3.5 h-3.5" />, shortcut: "L", category: "Tools", action: () => setTool("lasso") },
    { id: "tool-frame", label: "Frame", description: "Create a frame", icon: <Frame className="w-3.5 h-3.5" />, shortcut: "F", category: "Tools", action: () => setTool("frame") },
    { id: "tool-embed", label: "Embed", description: "Embed a URL/iframe", icon: <Globe className="w-3.5 h-3.5" />, shortcut: "W", category: "Tools", action: () => setTool("embed") },
    // Actions
    { id: "action-undo", label: "Undo", icon: <Undo2 className="w-3.5 h-3.5" />, shortcut: "Ctrl+Z", category: "Actions", action: undo },
    { id: "action-redo", label: "Redo", icon: <Redo2 className="w-3.5 h-3.5" />, shortcut: "Ctrl+Y", category: "Actions", action: redo },
    { id: "action-export", label: "Export as PNG", icon: <Download className="w-3.5 h-3.5" />, category: "Actions", action: exportPNG },
    { id: "action-clear", label: "Clear Canvas", description: "Remove all shapes", icon: <Trash2 className="w-3.5 h-3.5" />, category: "Actions", action: clearCanvas },
    // View
    { id: "view-zoom-in", label: "Zoom In", icon: <ZoomIn className="w-3.5 h-3.5" />, shortcut: "Ctrl++", category: "View", action: () => setScale(1.25) },
    { id: "view-zoom-out", label: "Zoom Out", icon: <ZoomOut className="w-3.5 h-3.5" />, shortcut: "Ctrl+-", category: "View", action: () => setScale(0.8) },
    { id: "view-zoom-reset", label: "Zoom to 100%", icon: <ZoomIn className="w-3.5 h-3.5" />, shortcut: "Ctrl+0", category: "View", action: () => setScale(1) },
    { id: "view-grid", label: "Toggle Snap to Grid", icon: <Grid3x3 className="w-3.5 h-3.5" />, category: "View", action: toggleGrid },
    { id: "view-shortcuts", label: "Keyboard Shortcuts", icon: <Clock className="w-3.5 h-3.5" />, shortcut: "?", category: "View", action: openShortcuts },
    // AI
    { id: "ai-diagram", label: "AI Diagram Generator", description: "Describe a diagram in plain English", icon: <Cpu className="w-3.5 h-3.5" />, category: "AI", action: openAI },
  ];
}
