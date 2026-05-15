"use client";

import { useEffect, useState, useCallback } from "react";
import { History, Clock, RotateCcw, Trash2, Plus, X, Loader2, CheckCircle2 } from "lucide-react";

interface Snapshot {
  id: string;
  label: string | null;
  shapeCount: number;
  createdAt: string;
}

interface VersionHistoryProps {
  boardId: string;
  onRestore: (shapes: object[]) => void;
  onClose: () => void;
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function VersionHistory({ boardId, onRestore, onClose }: VersionHistoryProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [restored, setRestored] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/boards/${boardId}/snapshots`);
    if (res.ok) {
      const data = await res.json();
      setSnapshots(data.snapshots);
    }
    setLoading(false);
  }, [boardId]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  const handleSaveSnapshot = async () => {
    setSaving(true);
    await fetch(`/api/boards/${boardId}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() || undefined }),
    });
    setLabel("");
    setShowLabelInput(false);
    setSaving(false);
    fetchSnapshots();
  };

  const handleRestore = async (snapshotId: string) => {
    setRestoring(snapshotId);
    const res = await fetch(`/api/boards/${boardId}/snapshots`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotId }),
    });
    if (res.ok) {
      const data = await res.json();
      let shapes: object[] = [];
      try { shapes = JSON.parse(data.board.shapes); } catch { shapes = []; }
      onRestore(shapes);
      setRestored(snapshotId);
      fetchSnapshots();
      setTimeout(() => setRestored(null), 3000);
    }
    setRestoring(null);
  };

  const handleDelete = async (snapshotId: string) => {
    await fetch(`/api/boards/${boardId}/snapshots?snapshotId=${snapshotId}`, { method: "DELETE" });
    setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sidebar panel */}
      <div className="relative h-full max-h-[90vh] w-80 rounded-2xl border border-white/10 bg-[#0d0d18]/97 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Version History</h2>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-md hover:bg-white/8 flex items-center justify-center text-white/40 hover:text-white transition-all">
            <X size={13} />
          </button>
        </div>

        {/* Save snapshot button */}
        <div className="p-3 border-b border-white/6">
          {showLabelInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Snapshot label (optional)"
                onKeyDown={e => e.key === "Enter" && handleSaveSnapshot()}
                className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
                autoFocus
              />
              <button onClick={handleSaveSnapshot} disabled={saving}
                className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium disabled:opacity-50 transition-all">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </button>
              <button onClick={() => setShowLabelInput(false)} className="px-2 py-1.5 rounded-lg text-white/30 hover:text-white/60 text-xs transition-all">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowLabelInput(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-white/15 hover:border-violet-500/40 text-white/40 hover:text-violet-400 text-xs transition-all">
              <Plus className="w-3.5 h-3.5" />
              Save current state as snapshot
            </button>
          )}
        </div>

        {/* Snapshots list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="w-8 h-8 text-white/10 mb-3" />
              <p className="text-xs text-white/25">No snapshots yet.</p>
              <p className="text-[10px] text-white/15 mt-1">Snapshots are created automatically every 20 saves.</p>
            </div>
          ) : (
            snapshots.map((snap, i) => (
              <div key={snap.id}
                className={`group relative flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  restored === snap.id
                    ? "border-emerald-500/40 bg-emerald-500/8"
                    : "border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4"
                }`}>
                {/* Timeline dot */}
                <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 ${i === 0 ? "border-violet-400 bg-violet-400/30" : "border-white/20 bg-transparent"}`} />
                  {i < snapshots.length - 1 && <div className="w-px flex-1 min-h-[16px] bg-white/8" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {snap.label || `Version ${snapshots.length - i}`}
                        {i === 0 && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">Latest</span>}
                      </p>
                      <p className="text-[10px] text-white/30 mt-0.5">{formatRelative(snap.createdAt)} · {snap.shapeCount} shapes</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRestore(snap.id)}
                      disabled={!!restoring}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/15 hover:bg-violet-600/25 text-violet-400 text-[10px] font-medium transition-all disabled:opacity-50"
                    >
                      {restoring === snap.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : restored === snap.id
                          ? <CheckCircle2 className="w-3 h-3" />
                          : <RotateCcw className="w-3 h-3" />}
                      {restored === snap.id ? "Restored!" : "Restore"}
                    </button>
                    <button
                      onClick={() => handleDelete(snap.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/4 hover:bg-red-500/15 text-white/30 hover:text-red-400 text-[10px] transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/6">
          <p className="text-[10px] text-white/20 text-center">Up to 20 snapshots per board · Auto-created every 20 saves</p>
        </div>
      </div>
    </div>
  );
}
