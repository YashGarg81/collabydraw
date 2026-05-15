"use client";

import { useEffect, useRef, useState } from "react";
import type { Shape } from "@/types/canvas";

interface MinimapProps {
  shapes: Shape[];
  scale: number;
  offsetX: number;
  offsetY: number;
  canvasWidth: number;
  canvasHeight: number;
}

const MINIMAP_W = 180;
const MINIMAP_H = 120;
const PADDING = 24;

// ── Bounds helpers ──────────────────────────────────────────────────────────

function getShapeBounds(shapes: Shape[]) {
  if (!shapes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const s of shapes) {
    if ("points" in s && Array.isArray(s.points) && s.points.length) {
      for (const p of s.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    } else if ("x" in s && "y" in s) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = s as any;
      const x1: number = a.x ?? 0;
      const y1: number = a.y ?? 0;
      const w: number = a.width ?? (a.radX != null ? a.radX * 2 : 60);
      const h: number = a.height ?? (a.radY != null ? a.radY * 2 : 40);
      if (x1 < minX) minX = x1;
      if (y1 < minY) minY = y1;
      if (x1 + w > maxX) maxX = x1 + w;
      if (y1 + h > maxY) maxY = y1 + h;
    }
  }

  if (!isFinite(minX)) return null;
  return {
    minX: minX - PADDING,
    minY: minY - PADDING,
    maxX: maxX + PADDING,
    maxY: maxY + PADDING,
  };
}

const SHAPE_COLORS: Record<string, string> = {
  rectangle:  "#7c3aed",
  ellipse:    "#2563eb",
  diamond:    "#ec4899",
  arrow:      "#94a3b8",
  line:       "#94a3b8",
  text:       "#e2e8f0",
  sticky:     "#fbbf24",
  "free-draw":"#a78bfa",
  frame:      "#4ade80",
  image:      "#f59e0b",
};

// ── Component ────────────────────────────────────────────────────────────────

export function Minimap({
  shapes,
  scale,
  offsetX,
  offsetY,
  canvasWidth,
  canvasHeight,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Set physical pixel size (DPR-aware) ──────────────────────────────
    const dpr = window.devicePixelRatio || 1;
    const physW = Math.round(MINIMAP_W * dpr);
    const physH = Math.round(MINIMAP_H * dpr);

    // Only resize if needed to avoid expensive reflows
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
    }

    // Reset transform completely before drawing
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── Background ──────────────────────────────────────────────────────
    ctx.fillStyle = "#0d0d14";
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    // ── Dot grid (always shown as background) ───────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let gx = 10; gx < MINIMAP_W; gx += 18) {
      for (let gy = 10; gy < MINIMAP_H; gy += 18) {
        ctx.beginPath();
        ctx.arc(gx, gy, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Compute world→minimap transform ─────────────────────────────────
    const bounds = getShapeBounds(shapes);
    const worldMinX = bounds?.minX ?? 0;
    const worldMinY = bounds?.minY ?? 0;
    const worldMaxX = bounds?.maxX ?? 800;
    const worldMaxY = bounds?.maxY ?? 600;
    const worldW = Math.max(worldMaxX - worldMinX, 1);
    const worldH = Math.max(worldMaxY - worldMinY, 1);

    const fitScale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);
    const drawScale = Math.min(fitScale, 0.4); // cap zoom-in so empty canvas looks sane
    const drawOffX = (MINIMAP_W - worldW * drawScale) / 2;
    const drawOffY = (MINIMAP_H - worldH * drawScale) / 2;

    function toMini(wx: number, wy: number) {
      return {
        x: drawOffX + (wx - worldMinX) * drawScale,
        y: drawOffY + (wy - worldMinY) * drawScale,
      };
    }

    // ── Draw shapes ──────────────────────────────────────────────────────
    if (bounds) {
      for (const shape of shapes) {
        const color = SHAPE_COLORS[shape.type] ?? "#64748b";
        ctx.fillStyle = color + "40";
        ctx.strokeStyle = color + "cc";
        ctx.lineWidth = 0.8;

        if (shape.type === "free-draw" && "points" in shape && Array.isArray(shape.points) && shape.points.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = color + "bb";
          ctx.lineWidth = 1;
          const first = toMini(shape.points[0].x, shape.points[0].y);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < shape.points.length; i++) {
            const p = toMini(shape.points[i].x, shape.points[i].y);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          continue;
        }

        if (!("x" in shape) || !("y" in shape)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = shape as any;
        const sx: number = a.x ?? 0;
        const sy: number = a.y ?? 0;
        const sw: number = a.width  ?? (a.radX != null ? a.radX * 2 : 60);
        const sh: number = a.height ?? (a.radY != null ? a.radY * 2 : 40);
        const { x, y } = toMini(sx, sy);
        const w = Math.max(sw * drawScale, 2);
        const h = Math.max(sh * drawScale, 2);

        if (shape.type === "ellipse") {
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (shape.type === "diamond") {
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w,     y + h / 2);
          ctx.lineTo(x + w / 2, y + h);
          ctx.lineTo(x,         y + h / 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (shape.type === "line" || shape.type === "arrow") {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y + h);
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // rectangle, frame, image, sticky, text, embed
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        }
      }
    }

    // ── Viewport indicator ───────────────────────────────────────────────
    if (canvasWidth > 0 && canvasHeight > 0 && scale > 0) {
      // offsetX/Y are the CSS pan offsets (px) the engine applies
      // World coords of the top-left viewport corner = -offset / scale
      const vpWorldX = -offsetX / scale;
      const vpWorldY = -offsetY / scale;
      const vpWorldW =  canvasWidth  / scale;
      const vpWorldH =  canvasHeight / scale;

      const { x: vx, y: vy } = toMini(vpWorldX, vpWorldY);
      const vw = vpWorldW * drawScale;
      const vh = vpWorldH * drawScale;

      ctx.strokeStyle = "rgba(139,92,246,0.85)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx, vy, vw, vh);
      ctx.fillStyle = "rgba(139,92,246,0.07)";
      ctx.fillRect(vx, vy, vw, vh);
    }
  }, [shapes, scale, offsetX, offsetY, canvasWidth, canvasHeight]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-xl overflow-hidden border transition-all select-none"
      style={{
        width: MINIMAP_W,
        height: MINIMAP_H,
        borderColor: hovered ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.08)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
        background: "#0d0d14",
        opacity: hovered ? 1 : 0.8,
        transition: "opacity 0.2s, border-color 0.2s",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: MINIMAP_W, height: MINIMAP_H, display: "block" }}
      />
      <div className="absolute top-1.5 left-2 text-[9px] font-mono text-white/20 pointer-events-none">
        minimap
      </div>
      {/* Zoom level badge */}
      <div className="absolute bottom-1.5 right-2 text-[9px] font-mono text-white/20 pointer-events-none">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
