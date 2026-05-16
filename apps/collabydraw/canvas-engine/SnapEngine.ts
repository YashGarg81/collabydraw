import { Shape } from "@/types/canvas";
import { SpatialIndex } from "./SpatialIndex";

export interface SnapResult {
  x: number;
  y: number;
  snapLines: SnapLine[];
}

export interface SnapLine {
  x?: number;
  y?: number;
}

export interface SnapConfig {
  enabled: boolean;
  gridEnabled: boolean;
  gridSize: number;
  threshold: number; // pixels in screen space
}

/**
 * Phase 4: SnapEngine
 *
 * Centralized snap calculation engine.
 * Separates snap logic from SelectionController for reusability and testability.
 *
 * Architecture:
 *  - Grid snapping: pure math, O(1)
 *  - Object snapping: uses SpatialIndex for O(log n) candidate selection
 *    so it never iterates all 10k+ shapes — only those visible/nearby.
 */
export class SnapEngine {
  public config: SnapConfig = {
    enabled: true,
    gridEnabled: false,
    gridSize: 20,
    threshold: 5,
  };

  // ─────────────────────────────────────────────
  // Grid Snap
  // ─────────────────────────────────────────────

  public snapToGrid(val: number): number {
    if (!this.config.gridEnabled) return val;
    return Math.round(val / this.config.gridSize) * this.config.gridSize;
  }

  public snapPointToGrid(x: number, y: number): { x: number; y: number } {
    return {
      x: this.snapToGrid(x),
      y: this.snapToGrid(y),
    };
  }

  // ─────────────────────────────────────────────
  // Object Smart Snap
  // ─────────────────────────────────────────────

  /**
   * Given a dragged bounding box (targetX, targetY, width, height),
   * snaps it against nearby shapes from the spatial index.
   *
   * Only shapes within 2x the threshold of the viewport vicinity are queried
   * from the R-tree, making this O(log n) not O(n).
   *
   * Returns adjusted (x, y) and active snap lines for guide rendering.
   */
  public snapDraggedBounds(
    targetX: number,
    targetY: number,
    width: number,
    height: number,
    spatialIndex: SpatialIndex,
    excludeShapes: Shape[],
    viewportBounds: { minX: number; minY: number; maxX: number; maxY: number }
  ): SnapResult {
    if (!this.config.enabled) {
      return { x: targetX, y: targetY, snapLines: [] };
    }

    // Query the R-tree with a slightly expanded viewport for candidates
    const queryBounds = {
      minX: viewportBounds.minX - 200,
      minY: viewportBounds.minY - 200,
      maxX: viewportBounds.maxX + 200,
      maxY: viewportBounds.maxY + 200,
    };

    const candidates = spatialIndex.getVisibleShapes(queryBounds);
    const excludeIds = new Set(excludeShapes.map((s) => s.id));
    const targets = candidates.filter((s) => !excludeIds.has(s.id));

    const threshold = this.config.threshold;

    let snappedX = targetX;
    let snappedY = targetY;
    let minSnapDx = threshold + 1;
    let minSnapDy = threshold + 1;
    let snappedXLine: number | undefined;
    let snappedYLine: number | undefined;

    const draggedCenterX = targetX + width / 2;
    const draggedCenterY = targetY + height / 2;
    const draggedRight = targetX + width;
    const draggedBottom = targetY + height;

    for (const shape of targets) {
      const bounds = SpatialIndex.getBounds(shape);

      const sCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
      const sCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
      const sRight = bounds.maxX;
      const sBottom = bounds.maxY;
      const sLeft = bounds.minX;
      const sTop = bounds.minY;

      // X-axis snap candidates: left, right, center
      const xSnaps = [
        { t: targetX, s: sLeft, offset: 0 },
        { t: targetX, s: sRight, offset: 0 },
        { t: draggedRight, s: sLeft, offset: -width },
        { t: draggedRight, s: sRight, offset: -width },
        { t: draggedCenterX, s: sCenterX, offset: -width / 2 },
      ];

      for (const { t, s, offset } of xSnaps) {
        const dist = Math.abs(t - s);
        if (dist < threshold && dist < minSnapDx) {
          minSnapDx = dist;
          snappedX = s + offset;
          snappedXLine = s;
        }
      }

      // Y-axis snap candidates: top, bottom, center
      const ySnaps = [
        { t: targetY, s: sTop, offset: 0 },
        { t: targetY, s: sBottom, offset: 0 },
        { t: draggedBottom, s: sTop, offset: -height },
        { t: draggedBottom, s: sBottom, offset: -height },
        { t: draggedCenterY, s: sCenterY, offset: -height / 2 },
      ];

      for (const { t, s, offset } of ySnaps) {
        const dist = Math.abs(t - s);
        if (dist < threshold && dist < minSnapDy) {
          minSnapDy = dist;
          snappedY = s + offset;
          snappedYLine = s;
        }
      }
    }

    const snapLines: SnapLine[] = [];
    if (snappedXLine !== undefined) snapLines.push({ x: snappedXLine });
    if (snappedYLine !== undefined) snapLines.push({ y: snappedYLine });

    return { x: snappedX, y: snappedY, snapLines };
  }

  // ─────────────────────────────────────────────
  // Grid Rendering
  // ─────────────────────────────────────────────

  /**
   * Render the grid overlay directly on the Canvas 2D context.
   * Zoom-aware: grid lines thin at low zoom, thicker at high zoom.
   * Only draws lines within the visible viewport (no off-screen overdraw).
   */
  public drawGrid(
    ctx: CanvasRenderingContext2D,
    panX: number,
    panY: number,
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
    darkMode: boolean
  ) {
    if (!this.config.gridEnabled) return;

    const { gridSize } = this.config;

    // Don't render the grid when zoomed out so far it becomes noise
    if (gridSize * scale < 4) return;

    const visStartX = -panX / scale;
    const visStartY = -panY / scale;
    const visEndX = (-panX + canvasWidth) / scale;
    const visEndY = (-panY + canvasHeight) / scale;

    // Start lines at the first grid boundary inside the viewport
    const startX = Math.floor(visStartX / gridSize) * gridSize;
    const startY = Math.floor(visStartY / gridSize) * gridSize;

    const dotSize = Math.max(1, 1 / scale);
    const gridColor = darkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

    ctx.save();
    ctx.fillStyle = gridColor;

    // Use dots for a clean Figma-style grid
    for (let x = startX; x <= visEndX; x += gridSize) {
      for (let y = startY; y <= visEndY; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
