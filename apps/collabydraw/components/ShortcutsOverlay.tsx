"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const SHORTCUT_SECTIONS = [
  {
    title: "Tools",
    shortcuts: [
      { key: "1", action: "Selection" },
      { key: "2", action: "Hand / Pan" },
      { key: "3", action: "Rectangle" },
      { key: "4", action: "Ellipse" },
      { key: "5", action: "Diamond" },
      { key: "6", action: "Line" },
      { key: "7", action: "Free Draw" },
      { key: "8", action: "Arrow" },
      { key: "9", action: "Text" },
      { key: "0", action: "Eraser" },
      { key: "S", action: "Sticky Note" },
      { key: "K", action: "Laser Pointer" },
      { key: "L", action: "Lasso Select" },
      { key: "F", action: "Frame" },
      { key: "W", action: "Embed" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { key: "Ctrl+Z", action: "Undo" },
      { key: "Ctrl+Y", action: "Redo" },
      { key: "Ctrl+A", action: "Select All" },
      { key: "Ctrl+D", action: "Duplicate" },
      { key: "Del / Backspace", action: "Delete selected" },
      { key: "Ctrl+G", action: "Group shapes" },
      { key: "Ctrl+Shift+G", action: "Ungroup shapes" },
    ],
  },
  {
    title: "Canvas",
    shortcuts: [
      { key: "Ctrl++", action: "Zoom In" },
      { key: "Ctrl+-", action: "Zoom Out" },
      { key: "Ctrl+0", action: "Reset Zoom" },
      { key: "Space + Drag", action: "Pan canvas" },
      { key: "Scroll", action: "Zoom in/out" },
    ],
  },
  {
    title: "UI",
    shortcuts: [
      { key: "Ctrl+K", action: "Command Palette" },
      { key: "?", action: "Keyboard Shortcuts" },
      { key: "Escape", action: "Deselect / Close" },
    ],
  },
];

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          /* ↓ Single wrapper: covers viewport, centers content, handles click-outside */
          className="fixed inset-0 z-[9990] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            /* Stop clicks inside the modal from closing it */
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-[#13131a]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div>
                <h2 className="text-white font-semibold text-base">Keyboard Shortcuts</h2>
                <p className="text-white/40 text-xs mt-0.5">Speed up your workflow</p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto custom-scrollbar p-6 grid grid-cols-2 gap-6">
              {SHORTCUT_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-violet-400/80 mb-3">
                    {section.title}
                  </h3>
                  <div className="space-y-1.5">
                    {section.shortcuts.map((s) => (
                      <div key={s.key} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-white/55">{s.action}</span>
                        <kbd className="shrink-0 text-[10px] font-mono text-white/40 border border-white/10 bg-white/3 rounded px-2 py-0.5 whitespace-nowrap">
                          {s.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

