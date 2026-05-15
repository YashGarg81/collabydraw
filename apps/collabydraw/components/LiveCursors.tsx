"use client";

import { useRef } from "react";

interface RemoteCursor {
  userId: string;
  userName: string;
  x: number; // canvas world coords
  y: number;
  color: string;
  lastSeen: number; // timestamp ms — fade after 3s inactivity
}

// Stable color per user based on userId hash
function userColor(userId: string): string {
  const COLORS = [
    "#7c3aed", "#db2777", "#0891b2", "#059669",
    "#d97706", "#dc2626", "#7c3aed", "#0284c7",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

interface LiveCursorsProps {
  cursors: Map<string, RemoteCursor>;
  // Transform: canvas coords → screen coords
  panX: number;
  panY: number;
  scale: number;
}

export function LiveCursors({ cursors, panX, panY, scale }: LiveCursorsProps) {
  const now = Date.now();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      {Array.from(cursors.values()).map(cursor => {
        const age = now - cursor.lastSeen;
        if (age > 5000) return null; // 5s timeout

        // World → screen
        const screenX = cursor.x * scale + panX;
        const screenY = cursor.y * scale + panY;

        const opacity = age > 3000 ? Math.max(0, 1 - (age - 3000) / 2000) : 1;

        return (
          <div
            key={cursor.userId}
            className="absolute transition-all duration-75"
            style={{ left: screenX, top: screenY, opacity, willChange: "transform" }}
          >
            {/* Cursor SVG */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="drop-shadow-lg">
              <path d="M3 2L17 10L10 12L7 18L3 2Z" fill={cursor.color} stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            {/* Name label */}
            <div
              className="absolute left-4 top-3 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white whitespace-nowrap shadow-lg"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.userName?.split(" ")[0] ?? "User"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Hook to manage remote cursor state
export function useRemoteCursors() {
  const cursorsRef = useRef<Map<string, RemoteCursor>>(new Map());
  const renderRef = useRef<(() => void) | null>(null);

  const updateCursor = (userId: string, userName: string, x: number, y: number) => {
    const color = userColor(userId);
    cursorsRef.current.set(userId, { userId, userName, x, y, color, lastSeen: Date.now() });
    renderRef.current?.();
  };

  const removeCursor = (userId: string) => {
    cursorsRef.current.delete(userId);
    renderRef.current?.();
  };

  return { cursorsRef, updateCursor, removeCursor, renderRef };
}
