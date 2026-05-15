"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Plus, LayoutGrid, Search, MoreHorizontal, Trash2,
  Pencil, LogOut, Loader2, Clock, Users, Globe, Zap,
  AlertTriangle, Pin, PinOff, Copy, ArrowUpDown, Upload, X
} from "lucide-react";
import { PLAN_DISPLAY, PLAN_COLORS, type Plan } from "@/config/planLimits";
import { FolderList, type FolderItem } from "@/components/FolderList";
import { NotificationPanel } from "@/components/NotificationPanel";
import { GlobalSearch } from "@/components/GlobalSearch";

interface Board {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  color: string | null;
  icon: string | null;
  isPublic: boolean;
  isPinned: boolean;
  shapeCount: number;
  updatedAt: string;
  _count: { members: number };
}

type SortOption = "newest" | "oldest" | "name";

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
  const [sort, setSort] = useState<SortOption>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [personalizeId, setPersonalizeId] = useState<string | null>(null);
  const [personalizeData, setPersonalizeData] = useState({ color: "", icon: "" });
  const importRef = useRef<HTMLInputElement>(null);
  // Phase 4: Folders + Global Search
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin?callbackUrl=/dashboard");
  }, [status, router]);

  // Cmd+K shortcut for global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(s => !s);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const fetchBoards = useCallback(async (s: SortOption = "newest") => {
    try {
      const res = await fetch(`/api/boards?sort=${s}`);
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards);
        if (data.meta) setPlanMeta(data.meta);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      const data = await res.json();
      setFolders(data.folders ?? []);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchBoards(sort);
      fetchFolders();
    }
  }, [status, fetchBoards, fetchFolders, sort]);

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
        if (data.error === "PLAN_LIMIT") { setPlanError(data.message); return; }
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

  async function togglePin(board: Board) {
    const next = !board.isPinned;
    setBoards((prev) => {
      const updated = prev.map((b) => b.id === board.id ? { ...b, isPinned: next } : b);
      // Re-sort: pinned first
      return [...updated.filter(b => b.isPinned), ...updated.filter(b => !b.isPinned)];
    });
    setOpenMenu(null);
    await fetch(`/api/boards/${board.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: next }),
    });
  }

  async function duplicateBoard(board: Board) {
    setDuplicating(board.id);
    setOpenMenu(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateFrom: board.id }),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "PLAN_LIMIT") { setPlanError(data.message); return; }
      }
      if (res.ok) {
        await fetchBoards(sort);
      }
    } finally {
      setDuplicating(null);
    }
  }

  // ── Personalize Board ────────────────────────────────────────────────
  async function submitPersonalize(id: string) {
    try {
      const res = await fetch(`/api/boards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: personalizeData.color, icon: personalizeData.icon }),
      });
      if (res.ok) {
        await fetchBoards(sort);
      }
    } finally {
      setPersonalizeId(null);
    }
  }

  // ── Import JSON board ────────────────────────────────────────────────
  async function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const shapes = Array.isArray(parsed) ? parsed : parsed.shapes;
      if (!Array.isArray(shapes)) throw new Error("Invalid format");

      // Create a new board then save shapes to it
      const createRes = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(".json", "") || "Imported Board" }),
      });
      if (createRes.status === 403) {
        const data = await createRes.json();
        if (data.error === "PLAN_LIMIT") { setPlanError(data.message); return; }
      }
      if (createRes.ok) {
        const { board } = await createRes.json();
        await fetch(`/api/boards/${board.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shapes }),
        });
        router.push(`/canvas?board=${board.id}`);
      }
    } catch {
      alert("Could not import: invalid JSON file. Make sure it was exported from CollabyDraw.");
    }
    // Reset input
    if (importRef.current) importRef.current.value = "";
  }

  const filtered = boards.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.description ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const pinned = filtered.filter(b => b.isPinned);
  const unpinned = filtered.filter(b => !b.isPinned);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  const sortLabels: Record<SortOption, string> = {
    newest: "Last updated",
    oldest: "Oldest first",
    name: "Name (A–Z)",
  };

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
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
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
          <Link
            href="/dashboard/integrations"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 text-sm transition-colors"
          >
            <Globe className="w-4 h-4" />
            Integrations & API
          </Link>
          {/* Import JSON shortcut */}
          <button
            onClick={() => importRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 text-sm transition-colors text-left"
          >
            <Upload className="w-4 h-4" />
            Import JSON
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />

          {/* Phase 4: Folders */}
          <FolderList
            folders={folders}
            allBoards={boards.map(b => ({ id: b.id, name: b.name }))}
            onFolderCreated={(f) => setFolders(prev => [...prev, f])}
            onFolderRenamed={(id, name) => setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))}
            onFolderDeleted={(id) => setFolders(prev => prev.filter(f => f.id !== id))}
            onBoardAddedToFolder={(folderId, boardId) => {
              const board = boards.find(b => b.id === boardId);
              if (!board) return;
              setFolders(prev => prev.map(f => f.id === folderId
                ? { ...f, boards: [...f.boards, { board: { id: board.id, name: board.name } }] }
                : f
              ));
            }}
            onBoardRemovedFromFolder={(folderId, boardId) => {
              setFolders(prev => prev.map(f => f.id === folderId
                ? { ...f, boards: f.boards.filter((fb: { board: { id: string } }) => fb.board.id !== boardId) }
                : f
              ));
            }}
          />
        </nav>

        {/* User + Plan */}
        <div className="border-t border-white/6 p-4 space-y-4">
          {planMeta && planMeta.plan === "FREE" && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/10 border border-violet-500/20">
              <div className="flex items-center gap-2 text-violet-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Zap className="w-3 h-3 fill-violet-400" /> Free Plan
              </div>
              <div className="text-[11px] text-white/60 mb-2">
                {planMeta.boardCount} / {planMeta.boardLimit} boards used
              </div>
              <button 
                onClick={async () => {
                  const res = await fetch("/api/billing/mock-upgrade", { method: "POST" });
                  if (res.ok) window.location.reload();
                }}
                className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold transition-all shadow-lg shadow-violet-600/20"
              >
                Upgrade to Pro
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{session?.user?.name}</div>
              <div className="text-[10px] text-white/35 truncate">{session?.user?.email}</div>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/5 transition-all"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          {planMeta && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3 ${PLAN_COLORS[planMeta.plan as Plan] ?? "bg-white/10 text-white/60"}`}>
              {PLAN_DISPLAY[planMeta.plan as Plan] ?? planMeta.plan}
            </div>
          )}
          {planMeta && planMeta.boardLimit !== null && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-white/30 mb-1">
                <span>Boards</span>
                <span>{planMeta.boardCount} / {planMeta.boardLimit}</span>
              </div>
              <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                  style={{ width: `${Math.min(100, (planMeta.boardCount / planMeta.boardLimit) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {planMeta && (
            <div className="text-[10px] text-white/25 mb-3">
              AI Credits: <span className="text-white/50 font-medium">{planMeta.aiCredits}</span>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 text-white/35 hover:text-white/60 text-xs transition-colors w-full"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="pl-60 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/6 px-8 h-16 flex items-center justify-between gap-4">
          <h1 className="text-base font-semibold text-white shrink-0">My Boards</h1>

          {/* Cmd+K search trigger */}
          <button
            id="global-search-trigger"
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg bg-white/5 border border-white/8 text-xs text-white/30 hover:text-white/60 hover:bg-white/8 transition-all flex-1 max-w-[240px]"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search boards…</span>
            <kbd className="text-[10px] border border-white/10 px-1 rounded">⌘K</kbd>
          </button>

          <div className="flex items-center gap-3 flex-1 max-w-lg">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search boards…"
                className="w-full h-8 pl-9 pr-3 rounded-lg bg-white/5 border border-white/8 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/40 focus:bg-white/7 transition-all"
                suppressHydrationWarning
              />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(p => !p)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/5 border border-white/8 text-xs text-white/50 hover:text-white/80 hover:bg-white/8 transition-all"
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortLabels[sort]}
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-white/10 bg-[#13131a]/98 backdrop-blur-2xl shadow-2xl p-1">
                  {(["newest", "oldest", "name"] as SortOption[]).map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setSort(opt); setSortOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${sort === opt ? "bg-violet-600/20 text-violet-300" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
                    >
                      {sortLabels[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Phase 4: Notifications */}
          <NotificationPanel />

          <button
            onClick={createBoard}
            disabled={creating || (planMeta?.atLimit ?? false)}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            New Board
          </button>
        </header>

        <div className="p-8 space-y-8" onClick={() => { setOpenMenu(null); setSortOpen(false); }}>
          {/* Plan error */}
          {planError && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/8 text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">{planError}
                <Link href="/pricing" className="ml-2 underline underline-offset-2 hover:text-amber-300">Upgrade →</Link>
              </div>
              <button onClick={() => setPlanError(null)} className="text-amber-400/50 hover:text-amber-400 text-xs">✕</button>
            </div>
          )}

          {/* Empty state */}
          {filtered.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-4">
                <LayoutGrid className="w-7 h-7 text-white/20" />
              </div>
              <p className="text-white/40 text-sm mb-1">{search ? "No boards match your search" : "No boards yet"}</p>
              {!search && <p className="text-white/20 text-xs">Create your first board to get started</p>}
            </div>
          )}

          {/* Pinned section */}
          {pinned.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Pin className="w-3.5 h-3.5 text-amber-400" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Pinned</h2>
              </div>
              <BoardGrid boards={pinned} onOpen={(b) => router.push(`/canvas?board=${b.id}`)} onRename={(b) => { setRenamingId(b.id); setRenameValue(b.name); }} renamingId={renamingId} renameValue={renameValue} setRenameValue={setRenameValue} onRenameSubmit={renameBoard} onDelete={deleteBoard} onTogglePin={togglePin} onDuplicate={duplicateBoard} openMenu={openMenu} setOpenMenu={setOpenMenu} duplicating={duplicating} onPersonalize={(b) => { setPersonalizeId(b.id); setPersonalizeData({ color: b.color || "", icon: b.icon || "" }); }} />
            </section>
          )}

          {/* All boards */}
          {unpinned.length > 0 && (
            <section>
              {pinned.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">All Boards</h2>
                </div>
              )}
              <BoardGrid boards={unpinned} onOpen={(b) => router.push(`/canvas?board=${b.id}`)} onRename={(b) => { setRenamingId(b.id); setRenameValue(b.name); }} renamingId={renamingId} renameValue={renameValue} setRenameValue={setRenameValue} onRenameSubmit={renameBoard} onDelete={deleteBoard} onTogglePin={togglePin} onDuplicate={duplicateBoard} openMenu={openMenu} setOpenMenu={setOpenMenu} duplicating={duplicating} onPersonalize={(b) => { setPersonalizeId(b.id); setPersonalizeData({ color: b.color || "", icon: b.icon || "" }); }} />
            </section>
          )}
        </div>
      </main>

      {/* Personalize Modal */}
      {personalizeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#13131a] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Personalize Board</h3>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="text-xs font-medium text-white/50 mb-2 block">Cover Gradient</label>
                <div className="grid grid-cols-6 gap-2">
                  <button onClick={() => setPersonalizeData(p => ({ ...p, color: "" }))} className={`h-8 rounded-lg bg-[#232329] border border-white/10 flex items-center justify-center ${!personalizeData.color ? "ring-2 ring-violet-500" : ""}`}>
                    <X className="w-3.5 h-3.5 text-white/40" />
                  </button>
                  {BOARD_COLORS.map(c => (
                    <button key={c} onClick={() => setPersonalizeData(p => ({ ...p, color: c }))} className={`h-8 rounded-lg bg-gradient-to-br ${c} border border-white/10 ${personalizeData.color === c ? "ring-2 ring-white" : ""}`} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-2 block">Emoji Icon</label>
                <input
                  value={personalizeData.icon}
                  onChange={e => setPersonalizeData(p => ({ ...p, icon: e.target.value }))}
                  placeholder="🚀"
                  maxLength={2}
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50"
                  suppressHydrationWarning
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/5 bg-white/[0.02] flex gap-2 justify-end">
              <button onClick={() => setPersonalizeId(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button onClick={() => submitPersonalize(personalizeId)} className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Global Search Overlay */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

// ── Board Grid Component ──────────────────────────────────────────────────────

interface BoardGridProps {
  boards: Board[];
  onOpen: (b: Board) => void;
  onRename: (b: Board) => void;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onRenameSubmit: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (b: Board) => void;
  onDuplicate: (b: Board) => void;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  duplicating: string | null;
  onPersonalize: (b: Board) => void;
}

function BoardGrid({ boards, onOpen, onRename, renamingId, renameValue, setRenameValue, onRenameSubmit, onDelete, onTogglePin, onDuplicate, openMenu, setOpenMenu, duplicating, onPersonalize }: BoardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {boards.map((board, i) => {
        const colorClass = board.color || BOARD_COLORS[i % BOARD_COLORS.length];
        const isMenuOpen = openMenu === board.id;
        const isDuplicating = duplicating === board.id;

        return (
          <div key={board.id} className="group relative rounded-2xl border border-white/8 bg-[#0d0d14] hover:border-white/15 hover:bg-[#111118] transition-all overflow-hidden">
            {/* Preview area */}
            <div
              className={`h-36 bg-gradient-to-br ${colorClass} cursor-pointer relative overflow-hidden`}
              onClick={() => onOpen(board)}
            >
              {board.icon && (
                <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-40 mix-blend-overlay pointer-events-none">
                  {board.icon}
                </div>
              )}
              {board.isPinned && (
                <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Pin className="w-2.5 h-2.5 text-amber-400" />
                </div>
              )}
              {board.isPublic && (
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                  <Globe className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[9px] text-emerald-400 font-medium">Public</span>
                </div>
              )}
              {/* Shape count badge */}
              {board.shapeCount > 0 && (
                <div className="absolute bottom-2.5 left-2.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
                  <span className="text-[9px] text-white/60">{board.shapeCount} {board.shapeCount === 1 ? "shape" : "shapes"}</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              {renamingId === board.id ? (
                <form onSubmit={e => { e.preventDefault(); onRenameSubmit(board.id, renameValue || board.name); }} className="flex gap-1.5">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => onRenameSubmit(board.id, renameValue || board.name)}
                    className="flex-1 text-sm text-white bg-white/8 border border-white/15 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500/50 min-w-0"
                    suppressHydrationWarning
                  />
                </form>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => onOpen(board)}
                    className="text-sm font-medium text-white hover:text-white/80 truncate text-left transition-colors flex-1 min-w-0"
                  >
                    {board.name}
                  </button>
                  {/* Context menu */}
                  <div className="relative shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenu(isMenuOpen ? null : board.id); }}
                      className="w-6 h-6 rounded-lg bg-white/0 hover:bg-white/8 flex items-center justify-center text-white/30 hover:text-white/70 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                    {isMenuOpen && (
                      <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-white/10 bg-[#13131a]/98 backdrop-blur-2xl shadow-2xl p-1" onClick={e => e.stopPropagation()}>
                        <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Rename" onClick={() => { onRename(board); setOpenMenu(null); }} />
                        <MenuItem icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Personalize" onClick={() => { onPersonalize(board); setOpenMenu(null); }} />
                        <MenuItem icon={board.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />} label={board.isPinned ? "Unpin" : "Pin to top"} onClick={() => onTogglePin(board)} />
                        <MenuItem icon={isDuplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} label="Duplicate" onClick={() => onDuplicate(board)} disabled={isDuplicating} />
                        <div className="my-1 h-px bg-white/6" />
                        <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={() => onDelete(board.id)} danger />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/25">
                <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatRelative(board.updatedAt)}</span>
                {board._count.members > 0 && (
                  <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{board._count.members}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger, disabled }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-40 ${danger ? "text-red-400 hover:bg-red-500/10" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
    >
      {icon}{label}
    </button>
  );
}
