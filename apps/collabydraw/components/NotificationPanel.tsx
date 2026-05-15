"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Check, Trash2, UserPlus, MessageSquare, Share2, Users } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  payload: string;
  read: boolean;
  createdAt: string;
}

interface ParsedPayload {
  boardId?: string;
  boardName?: string;
  actorName?: string;
  message?: string;
}

function getIcon(type: string) {
  switch (type) {
    case "board_invite": return <UserPlus className="w-4 h-4 text-violet-400" />;
    case "comment_added": return <MessageSquare className="w-4 h-4 text-sky-400" />;
    case "board_shared": return <Share2 className="w-4 h-4 text-emerald-400" />;
    case "member_joined": return <Users className="w-4 h-4 text-amber-400" />;
    default: return <Bell className="w-4 h-4 text-white/40" />;
  }
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

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30s
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const markOne = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const clearAll = async () => {
    await fetch("/api/notifications", { method: "DELETE" });
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell"
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-white/10 bg-[#0d0d14]/98 backdrop-blur-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-violet-500/10 transition"
                >
                  <Check className="w-3 h-3" /> All read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="py-8 text-center text-white/30 text-sm">Loading…</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-sm text-white/30">No notifications yet</p>
              </div>
            )}
            {notifications.map(n => {
              let payload: ParsedPayload = {};
              try { payload = JSON.parse(n.payload); } catch {}
              return (
                <button
                  key={n.id}
                  onClick={() => { if (!n.read) markOne(n.id); }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/4 transition-colors border-b border-white/4 last:border-0 ${!n.read ? "bg-violet-500/5" : ""}`}
                >
                  <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-white/6 flex items-center justify-center">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 leading-relaxed">
                      {payload.message ?? `${payload.actorName} performed an action on ${payload.boardName}`}
                    </p>
                    <p className="text-[10px] text-white/25 mt-0.5">{formatRelative(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-violet-500 mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
