"use client";

import { useState, useCallback } from "react";
import { Globe, Lock, Link2, CheckCircle2, X, Download, ExternalLink } from "lucide-react";

interface ShareModalProps {
  boardId: string;
  boardName: string;
  isPublic: boolean;
  onClose: () => void;
  onTogglePublic: (isPublic: boolean) => void;
  onExport: () => void;
  onExportSVG?: () => void;
  onExportJSON?: () => void;
  onCopyClipboard?: () => Promise<boolean>;
}

export function ShareModal({ boardId, boardName, isPublic, onClose, onTogglePublic, onExport, onExportSVG, onExportJSON, onCopyClipboard }: ShareModalProps) {
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clipCopied, setClipCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/board/${boardId}`
    : `/board/${boardId}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }, [shareUrl]);

  const handleToggle = useCallback(async () => {
    setToggling(true);
    const next = !isPublic;
    await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
    onTogglePublic(next);
    setToggling(false);
  }, [boardId, isPublic, onTogglePublic]);

  const handleCopyClipboard = async () => {
    if (!onCopyClipboard) return;
    const ok = await onCopyClipboard();
    if (ok) { setClipCopied(true); setTimeout(() => setClipCopied(false), 2500); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f1a]/98 backdrop-blur-2xl shadow-2xl shadow-black/70 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Share &ldquo;{boardName}&rdquo;</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Public toggle */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-white/8 bg-white/3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isPublic ? "bg-emerald-500/15 text-emerald-400" : "bg-white/8 text-white/30"}`}>
            {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{isPublic ? "Public link enabled" : "Private board"}</span>
              <button onClick={handleToggle} disabled={toggling}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${isPublic ? "bg-emerald-500" : "bg-white/15"} disabled:opacity-50`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublic ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <p className="text-xs text-white/35 mt-0.5">
              {isPublic ? "Anyone with the link can view this board (read-only)" : "Only you and board members can access this"}
            </p>
          </div>
        </div>

        {/* Copy link */}
        {isPublic && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Share link</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/4 min-w-0">
                <Link2 className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                <span className="text-xs text-white/50 truncate font-mono">{shareUrl}</span>
              </div>
              <button onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-shrink-0 ${copied ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-violet-600 hover:bg-violet-500 text-white"}`}>
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              <ExternalLink className="w-3 h-3" /> Open public view
            </a>
          </div>
        )}

        <div className="h-px bg-white/6" />

        {/* Export */}
        <div>
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider block mb-2">Export</label>
          <div className="space-y-1.5">
            {/* PNG */}
            <button onClick={() => { onExport(); onClose(); }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/12 transition-all text-left">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 flex-shrink-0">
                <Download className="w-3.5 h-3.5" />
              </div>
              <div><div className="text-xs font-medium text-white">Export as PNG</div><div className="text-[10px] text-white/35">High-resolution raster image</div></div>
            </button>

            {/* SVG */}
            {onExportSVG && (
              <button onClick={() => { onExportSVG(); onClose(); }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/12 transition-all text-left">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                </div>
                <div><div className="text-xs font-medium text-white">Export as SVG</div><div className="text-[10px] text-white/35">Vector — perfect for Figma / Illustrator</div></div>
              </button>
            )}

            {/* JSON */}
            {onExportJSON && (
              <button onClick={() => { onExportJSON(); onClose(); }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/12 transition-all text-left">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                </div>
                <div><div className="text-xs font-medium text-white">Export as JSON</div><div className="text-[10px] text-white/35">Re-import into any CollabyDraw board</div></div>
              </button>
            )}

            {/* Copy to clipboard */}
            {onCopyClipboard && (
              <button onClick={handleCopyClipboard}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${clipCopied ? "border-emerald-500/30 bg-emerald-500/8" : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/12"}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${clipCopied ? "bg-emerald-500/20 text-emerald-400" : "bg-violet-500/15 text-violet-400"}`}>
                  {clipCopied
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
                </div>
                <div>
                  <div className="text-xs font-medium text-white">{clipCopied ? "Copied to clipboard!" : "Copy PNG to clipboard"}</div>
                  <div className="text-[10px] text-white/35">Paste into Notion, Slack, docs…</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
