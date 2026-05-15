"use client";

/**
 * Phase 2: Canvas Rulers
 * Renders top (horizontal) and left (vertical) rulers that
 * respond to the canvas pan position and zoom scale.
 *
 * Usage: pass engine and call engine.getViewport() on each render tick.
 */

import React, { useEffect, useRef } from "react";

const RULER_SIZE = 20; // px thickness of each ruler
const TICK_COLOR_MAJOR = "rgba(255,255,255,0.35)";
const TICK_COLOR_MINOR = "rgba(255,255,255,0.12)";
const LABEL_COLOR      = "rgba(255,255,255,0.35)";
const RULER_BG         = "rgba(13,13,20,0.96)";

interface RulersProps {
  panX: number;
  panY: number;
  scale: number;
  width: number;   // canvas viewport width (px)
  height: number;  // canvas viewport height (px)
}

function drawRuler(
  ctx: CanvasRenderingContext2D,
  axis: "x" | "y",
  pan: number,
  scale: number,
  viewportSize: number
) {
  const isX = axis === "x";
  ctx.clearRect(0, 0, isX ? viewportSize : RULER_SIZE, isX ? RULER_SIZE : viewportSize);

  // Background
  ctx.fillStyle = RULER_BG;
  ctx.fillRect(0, 0, isX ? viewportSize : RULER_SIZE, isX ? RULER_SIZE : viewportSize);

  // Grid step in canvas-space — adaptive based on zoom
  const baseStep = scale >= 2 ? 25 : scale >= 1 ? 50 : scale >= 0.5 ? 100 : 200;
  const step = baseStep;        // world units per major tick
  const pixelStep = step * scale; // pixels per major tick

  // First world coordinate visible
  const worldStart = -pan / scale;
  const firstTick = Math.floor(worldStart / step) * step;

  ctx.font = `9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let w = firstTick; ; w += step) {
    const px = (w - worldStart) * scale; // pixel position on screen
    if (px > viewportSize + pixelStep) break;

    // Major tick
    ctx.strokeStyle = TICK_COLOR_MAJOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (isX) {
      ctx.moveTo(px, RULER_SIZE);
      ctx.lineTo(px, RULER_SIZE - 8);
    } else {
      ctx.moveTo(RULER_SIZE, px);
      ctx.lineTo(RULER_SIZE - 8, px);
    }
    ctx.stroke();

    // Label
    ctx.fillStyle = LABEL_COLOR;
    if (isX) {
      ctx.save(); ctx.translate(px, RULER_SIZE / 2 - 1);
      ctx.fillText(String(Math.round(w)), 0, 0);
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(RULER_SIZE / 2 - 1, px);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(Math.round(w)), 0, 0);
      ctx.restore();
    }

    // Minor ticks (5 subdivisions)
    const minorStep = pixelStep / 5;
    ctx.strokeStyle = TICK_COLOR_MINOR;
    ctx.lineWidth = 0.5;
    for (let m = 1; m < 5; m++) {
      const mpx = px + m * minorStep;
      ctx.beginPath();
      if (isX) { ctx.moveTo(mpx, RULER_SIZE); ctx.lineTo(mpx, RULER_SIZE - 4); }
      else      { ctx.moveTo(RULER_SIZE, mpx); ctx.lineTo(RULER_SIZE - 4, mpx); }
      ctx.stroke();
    }
  }

  // Border line
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (isX) { ctx.moveTo(0, RULER_SIZE - 0.5); ctx.lineTo(viewportSize, RULER_SIZE - 0.5); }
  else      { ctx.moveTo(RULER_SIZE - 0.5, 0); ctx.lineTo(RULER_SIZE - 0.5, viewportSize); }
  ctx.stroke();
}

export const RULER_SIZE_PX = RULER_SIZE;

export function Rulers({ panX, panY, scale, width, height }: RulersProps) {
  const hRef = useRef<HTMLCanvasElement>(null);
  const vRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const hCtx = hRef.current?.getContext("2d");
    const vCtx = vRef.current?.getContext("2d");
    if (hCtx) drawRuler(hCtx, "x", panX, scale, width);
    if (vCtx) drawRuler(vCtx, "y", panY, scale, height);
  }, [panX, panY, scale, width, height]);

  return (
    <>
      {/* Corner square */}
      <div
        style={{ width: RULER_SIZE, height: RULER_SIZE, left: 0, top: 0 }}
        className="absolute z-30 bg-[#0d0d14] border-r border-b border-white/6"
      />
      {/* Horizontal ruler */}
      <canvas
        ref={hRef}
        width={width}
        height={RULER_SIZE}
        style={{ left: RULER_SIZE, top: 0, width, height: RULER_SIZE }}
        className="absolute z-30 pointer-events-none"
      />
      {/* Vertical ruler */}
      <canvas
        ref={vRef}
        width={RULER_SIZE}
        height={height}
        style={{ left: 0, top: RULER_SIZE, width: RULER_SIZE, height }}
        className="absolute z-30 pointer-events-none"
      />
    </>
  );
}
