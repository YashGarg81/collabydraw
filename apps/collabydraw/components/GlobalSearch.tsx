"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutGrid, Zap, Loader2, Clock } from "lucide-react";

interface BoardResult {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  updatedAt: string;
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const BOARD_COLORS: Record<string, string> = {
  violet: "from-violet-600/50 to-indigo-600/30",
  blue: "from-blue-600/50 to-cyan-600/30",
  emerald: "from-emerald-600/50 to-teal-600/30",
  orange: "from-orange-600/50 to-yellow-600/30",
  pink: "from-pink-600/50 to-rose-600/30",
};

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [boards, setBoards] = useState<BoardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setBoards([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const goToBoard = (id: string) => {
    router.push(`/canvas?board=${id}`);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, boards.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && boards[activeIndex]) { goToBoard(boards[activeIndex].id); }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl mx-4 rounded-2xl border border-white/10 bg-[#0d0d14]/98 backdrop-blur-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/6">
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search boards…"
            className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            suppressHydrationWarning
          />
          {loading && <Loader2 className="w-4 h-4 text-white/30 animate-spin" />}
          <kbd className="hidden sm:block text-[10px] text-white/20 px-1.5 py-0.5 rounded border border-white/10">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length >= 2 && boards.length === 0 && !loading && (
            <div className="py-10 text-center">
              <Search className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">No boards found for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {boards.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25 flex items-center gap-1.5">
                <LayoutGrid className="w-3 h-3" /> Boards
              </div>
              {boards.map((board, i) => (
                <button
                  key={board.id}
                  onClick={() => goToBoard(board.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    i === activeIndex ? "bg-violet-600/20 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${BOARD_COLORS[board.color ?? "violet"] ?? "from-violet-600/40 to-indigo-600/20"} flex items-center justify-center shrink-0`}>
                    <LayoutGrid className="w-4 h-4 text-white/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{board.name}</div>
                    {board.description && (
                      <div className="text-xs text-white/35 truncate">{board.description}</div>
                    )}
                  </div>
                  <div className="text-[10px] text-white/25 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatRelative(board.updatedAt)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Quick actions (shown when no query) */}
          {query.length < 2 && (
            <div className="p-2">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Quick actions
              </div>
              {[
                { label: "Go to Dashboard", action: () => { router.push("/dashboard"); onClose(); }, icon: <LayoutGrid className="w-4 h-4" /> },
                { label: "Browse Templates", action: () => { router.push("/templates"); onClose(); }, icon: <Zap className="w-4 h-4" /> },
                { label: "New Canvas", action: () => { router.push("/canvas"); onClose(); }, icon: <Search className="w-4 h-4" /> },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-white/60 hover:bg-white/5 hover:text-white`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/6 flex items-center justify-center text-white/30">
                    {item.icon}
                  </div>
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/6 flex items-center gap-4 text-[10px] text-white/20">
          <span><kbd className="border border-white/10 px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="border border-white/10 px-1 rounded">↵</kbd> open</span>
          <span><kbd className="border border-white/10 px-1 rounded">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
