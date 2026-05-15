"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Plus, LayoutGrid, Search, MoreHorizontal, Trash2,
  Pencil, LogOut, Loader2, Clock, Users, Globe, Zap, AlertTriangle
} from "lucide-react";
import { PLAN_DISPLAY, PLAN_COLORS, type Plan } from "@/config/planLimits";

interface Board {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  isPublic: boolean;
  updatedAt: string;
  _count: { members: number };
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const BOARD_COLORS = [
  "from-violet-600/30 to-indigo-600/20",
  "from-blue-600/30 to-cyan-600/20",
  "from-emerald-600/30 to-teal-600/20",
  "from-orange-600/30 to-yellow-600/20",
  "from-pink-600/30 to-rose-600/20",
  "from-purple-600/30 to-fuchsia-600/20",
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planMeta, setPlanMeta] = useState<{
    plan: string; boardCount: number; boardLimit: number | null; atLimit: boolean; aiCredits: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin?callbackUrl=/dashboard");
  }, [status, router]);

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch("/api/boards");
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards);
        if (data.meta) setPlanMeta(data.meta);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchBoards();
  }, [status, fetchBoards]);

  async function createBoard() {
    setPlanError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Board" }),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "PLAN_LIMIT") {
          setPlanError(data.message);
          return;
        }
      }
      if (res.ok) {
        const data = await res.json();
        router.push(`/canvas?board=${data.board.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteBoard(id: string) {
    setBoards((prev) => prev.filter((b) => b.id !== id));
    setOpenMenu(null);
    await fetch(`/api/boards/${id}`, { method: "DELETE" });
  }

  async function renameBoard(id: string, name: string) {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
    setRenamingId(null);
    await fetch(`/api/boards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  const filtered = boards.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-60 border-r border-white/6 bg-[#0d0d14] flex flex-col z-30">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-white" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-white text-base">CollabyDraw</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-violet-600/15 text-violet-300 text-sm font-medium">
            <LayoutGrid className="w-4 h-4" />
            My Boards
          </div>
          <Link href="/canvas" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 text-sm transition-colors">
            <Pencil className="w-4 h-4" />
            New Canvas
          </Link>
          <Link href="/templates" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 text-sm transition-colors">
            <Zap className="w-4 h-4" />
            Templates
          </Link>
        </nav>

        {/* User + Plan */}
        <div className="border-t border-white/6 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{session?.user?.name}</div>
              <div className="text-xs text-white/35 truncate">{session?.user?.email}</div>
            </div>
          </div>
          {/* Plan badge */}
          {planMeta && (
            <div className="mb-3">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${PLAN_COLORS[planMeta.plan as Plan] ?? PLAN_COLORS.FREE}`}>
                <Zap className="w-2.5 h-2.5" />
                {PLAN_DISPLAY[(planMeta.plan as Plan)] ?? planMeta.plan} Plan
              </span>
              {planMeta.boardLimit !== null && (
                <div className="mt-1.5 text-[10px] text-white/30">
                  Boards: {planMeta.boardCount} / {planMeta.boardLimit}
                  <div className="mt-1 h-1 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500/60 transition-all"
                      style={{ width: `${Math.min((planMeta.boardCount / planMeta.boardLimit) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 text-sm transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-white/6 bg-[#0a0a0f]/95 backdrop-blur-xl flex items-center gap-4 px-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search boards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/8 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:bg-white/7 transition"
            />
          </div>
          <button
            onClick={createBoard}
            disabled={creating}
            id="create-board-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New board
          </button>
        </header>

        {/* Content */}
        <main className="p-6">
          {/* Plan limit error */}
          {planError && (
            <div className="mb-4 flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8 text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{planError}</p>
                <p className="text-xs text-amber-400/60 mt-0.5">Stripe integration coming soon. Contact us to upgrade.</p>
              </div>
              <button onClick={() => setPlanError(null)} className="text-amber-400/40 hover:text-amber-400 text-xs">✕</button>
            </div>
          )}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white flex items-center gap-3">
              My Boards
              {planMeta?.boardLimit !== null && planMeta && (
                <span className="text-sm font-normal text-white/30">{planMeta.boardCount} / {planMeta.boardLimit} boards</span>
              )}
            </h1>
            <p className="text-white/40 text-sm mt-0.5">{boards.length} board{boards.length !== 1 ? "s" : ""}</p>
          </div>

          {filtered.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <LayoutGrid className="w-7 h-7 text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                {search ? "No boards match your search" : "No boards yet"}
              </h2>
              <p className="text-white/40 text-sm mb-6 max-w-xs">
                {search ? "Try a different search term." : "Create your first board to start drawing and collaborating."}
              </p>
              {!search && (
                <button
                  onClick={createBoard}
                  disabled={creating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create your first board
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Create new card */}
              <button
                onClick={createBoard}
                disabled={creating}
                className="group relative rounded-2xl border border-dashed border-white/15 hover:border-violet-500/50 bg-white/2 hover:bg-violet-600/5 transition-all flex flex-col items-center justify-center min-h-[200px] text-white/30 hover:text-violet-400"
              >
                <Plus className="w-8 h-8 mb-2 transition-transform group-hover:scale-110" />
                <span className="text-sm font-medium">New board</span>
              </button>

              {filtered.map((board, i) => (
                <div
                  key={board.id}
                  className="group relative rounded-2xl border border-white/8 bg-[#0d0d14] hover:border-white/15 transition-all overflow-hidden"
                >
                  {/* Thumbnail area */}
                  <Link href={`/canvas?board=${board.id}`} className="block">
                    <div className={`h-32 bg-gradient-to-br ${BOARD_COLORS[i % BOARD_COLORS.length]} flex items-center justify-center`}>
                      <svg viewBox="0 0 120 80" className="w-24 opacity-40">
                        <rect x="10" y="20" width="40" height="25" rx="4" fill="none" stroke="white" strokeWidth="1.5" />
                        <rect x="70" y="20" width="40" height="25" rx="4" fill="none" stroke="white" strokeWidth="1.5" />
                        <line x1="50" y1="32" x2="70" y2="32" stroke="white" strokeWidth="1.5" />
                        <ellipse cx="60" cy="60" rx="18" ry="11" fill="none" stroke="white" strokeWidth="1.5" />
                      </svg>
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="p-4">
                    {renamingId === board.id ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); renameBoard(board.id, renameValue); }}
                        className="flex gap-2"
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => renameBoard(board.id, renameValue)}
                          className="flex-1 text-sm bg-white/5 border border-violet-500/50 rounded-md px-2 py-1 text-white focus:outline-none"
                        />
                      </form>
                    ) : (
                      <Link href={`/canvas?board=${board.id}`} className="block">
                        <div className="font-medium text-white text-sm truncate mb-1 group-hover:text-violet-300 transition-colors">
                          {board.name}
                        </div>
                      </Link>
                    )}

                    <div className="flex items-center gap-3 text-xs text-white/30">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelative(board.updatedAt)}
                      </span>
                      {board._count.members > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {board._count.members}
                        </span>
                      )}
                      {board.isPublic && <Globe className="w-3 h-3 text-emerald-400" />}
                    </div>
                  </div>

                  {/* Context menu trigger */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === board.id ? null : board.id); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {/* Dropdown */}
                  {openMenu === board.id && (
                    <div className="absolute top-12 right-3 z-20 w-44 rounded-xl border border-white/10 bg-[#1a1a24] shadow-2xl shadow-black/50 overflow-hidden text-sm">
                      <button
                        onClick={() => { setRenamingId(board.id); setRenameValue(board.name); setOpenMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      <button
                        onClick={() => deleteBoard(board.id)}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Close dropdown on outside click */}
      {openMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  );
}
