import { Shape } from "@/types/canvas";
import { getFontSize } from "@/utils/textUtils";

type Tool = Shape;

export interface ResizeHandle {
  x: number;
  y: number;
  cursor: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SelectionController {
  private canvas: HTMLCanvasElement;
  private selectedShapes: Tool[] = [];
  private isDragging: boolean = false;
  private isResizing: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  
  // For group dragging and resizing
  private originalShapeStates: Map<string, any> = new Map();

  private activeResizeHandle: ResizeHandle | null = null;
  private originalCombinedBounds: Bounds | null = null;

  private ctx: CanvasRenderingContext2D;
  public isSnapToGrid: boolean = false;
  public isSmartSnapping: boolean = true; // Smart object-to-object snapping
  public activeSnapLines: { x?: number; y?: number }[] = [];

  private getSnappedPoint(val: number): number {
    return this.isSnapToGrid ? Math.round(val / 20) * 20 : val;
  }

  private setCursor(cursor: string) {
    this.canvas.style.cursor = cursor;
  }

  private resetCursor() {
    this.canvas.style.cursor = "";
  }

  private onUpdateCallback: () => void = () => {};
  setOnUpdate(callback: () => void) {
    this.onUpdateCallback = callback;
  }
  private triggerUpdate() {
    this.onUpdateCallback();
  }

  private onSelectionChangeCallback: ((isSelected: boolean, count?: number, isGrouped?: boolean) => void) | null = null;
  setOnSelectionChange(cb: (isSelected: boolean, count?: number, isGrouped?: boolean) => void) {
    this.onSelectionChangeCallback = cb;
  }

  private onLiveUpdateCallback: ((shapes: Tool[]) => void) | null = null;
  setOnLiveUpdate(cb: (shapes: Tool[]) => void) {
    this.onLiveUpdateCallback = cb;
  }
  
  private onDragOrResizeCursorMove: ((x: number, y: number) => void) | null = null;
  public setOnDragOrResizeCursorMove(cb: (x: number, y: number) => void) {
    this.onDragOrResizeCursorMove = cb;
  }
  
  constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    this.ctx = ctx;
    this.canvas = canvas;
  }

  getSelectedShapes(): Tool[] {
    return this.selectedShapes;
  }
  
  getSelectedShape(): Tool | null {
    return this.selectedShapes.length > 0 ? this.selectedShapes[0] : null;
  }

  setSelectedShapes(shapes: Tool[]) {
    if (this.selectedShapes.length === shapes.length && this.selectedShapes.every((s, i) => s === shapes[i])) return;
    this.selectedShapes = shapes;
    if (this.onSelectionChangeCallback) {
      const isGrouped = this.selectedShapes.some(s => s.groupId);
      this.onSelectionChangeCallback(this.selectedShapes.length > 0, this.selectedShapes.length, isGrouped);
    }
  }

  setSelectedShape(shape: Tool | null) {
    if (shape === null) {
      this.setSelectedShapes([]);
    } else {
      this.setSelectedShapes([shape]);
    }
  }

  toggleShapeSelection(shape: Tool) {
    const index = this.selectedShapes.findIndex(s => s.id === shape.id);
    if (index !== -1) {
      const newSelection = [...this.selectedShapes];
      newSelection.splice(index, 1);
      this.setSelectedShapes(newSelection);
    } else {
      this.setSelectedShapes([...this.selectedShapes, shape]);
    }
  }

  hasSelection(): boolean {
    return this.selectedShapes.length > 0;
  }
  
  isShapeSelected(): boolean {
    return this.hasSelection();
  }

  isDraggingShape(): boolean {
    return this.isDragging;
  }

  isResizingShape(): boolean {
    return this.isResizing;
  }

  getShapeBounds(shape: Tool): Bounds {
    if (shape.type !== "free-draw") {
      const bounds = {
        x: shape.x,
        y: shape.y,
        width: 0,
        height: 0,
      };

      switch (shape.type) {
        case "rectangle":
        case "sticky":
        case "image":
        case "frame":
        case "embed":
          bounds.width = shape.width || 0;
          bounds.height = shape.height || 0;
          if (bounds.width < 0) {
            bounds.x += bounds.width;
            bounds.width = Math.abs(bounds.width);
          }
          if (bounds.height < 0) {
            bounds.y += bounds.height;
            bounds.height = Math.abs(bounds.height);
          }
          bounds.x -= 4;
          bounds.y -= 4;
          bounds.width += 8;
          bounds.height += 8;
          break;

        case "ellipse":
          bounds.x = shape.x - (shape.radX || 0);
          bounds.y = shape.y - (shape.radY || 0);
          bounds.width = (shape.radX || 0) * 2;
          bounds.height = (shape.radY || 0) * 2;
          break;

        case "diamond":
          bounds.width = shape.width;
          bounds.height = shape.height;
          bounds.x = shape.x - shape.width / 2;
          bounds.y = shape.y - shape.height / 2;
          break;

        case "line":
        case "arrow":
          const minX = Math.min(shape.x, shape.toX);
          const minY = Math.min(shape.y, shape.toY);
          const maxX = Math.max(shape.x, shape.toX);
          const maxY = Math.max(shape.y, shape.toY);

          bounds.x = minX - shape.strokeWidth - 20;
          bounds.y = minY - shape.strokeWidth - 20;
          bounds.width = maxX - minX + shape.strokeWidth * 2 + 40;
          bounds.height = maxY - minY + shape.strokeWidth * 2 + 40;
          break;

        case "text":
          const calFontSize = getFontSize(shape.fontSize, 100);
          this.ctx.font = `${calFontSize}px/1.2 ${shape.fontFamily === "normal" ? "Arial" : shape.fontFamily === "hand-drawn" ? "Collabyfont, Xiaolai" : "Assistant"}`;
          bounds.x = shape.x;
          bounds.y = shape.y;
          bounds.width = shape.width;
          bounds.height = shape.height;
          break;
      }

      return bounds;
    }
    
    // Free-draw bounds
    if (shape.points && shape.points.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        shape.points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
        return {
            x: minX - 10,
            y: minY - 10,
            width: maxX - minX + 20,
            height: maxY - minY + 20
        };
    }

    return { x: 0, y: 0, width: 0, height: 0 };
  }

  getCombinedBounds(): Bounds | null {
    if (this.selectedShapes.length === 0) return null;
    if (this.selectedShapes.length === 1) return this.getShapeBounds(this.selectedShapes[0]);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const shape of this.selectedShapes) {
      const bounds = this.getShapeBounds(shape);
      if (bounds.x < minX) minX = bounds.x;
      if (bounds.y < minY) minY = bounds.y;
      if (bounds.x + bounds.width > maxX) maxX = bounds.x + bounds.width;
      if (bounds.y + bounds.height > maxY) maxY = bounds.y + bounds.height;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private getResizeHandles(bounds: Bounds): ResizeHandle[] {
    return [
      { x: bounds.x, y: bounds.y, cursor: "nw-resize", position: "top-left" },
      { x: bounds.x + bounds.width, y: bounds.y, cursor: "ne-resize", position: "top-right" },
      { x: bounds.x, y: bounds.y + bounds.height, cursor: "sw-resize", position: "bottom-left" },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: "se-resize", position: "bottom-right" },
    ];
  }

  drawSelectionBox() {
    const bounds = this.getCombinedBounds();
    if (!bounds) return;

    this.ctx.save();

    const borderColor = "#6965db";
    const handleBorderColor = "#6965db";
    const handleFillColor = "#ffffff";
    const handleSize = 10;

    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 1;

    this.ctx.beginPath();
    this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    const handles = this.getResizeHandles(bounds);
    handles.forEach((handle) => {
      this.ctx.beginPath();
      this.ctx.fillStyle = handleFillColor;
      this.ctx.strokeStyle = handleBorderColor;
      this.ctx.roundRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize,
        3
      );
      this.ctx.fill();
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  doBoundsIntersect(b1: Bounds, b2: Bounds): boolean {
    return !(
      b2.x > b1.x + b1.width ||
      b2.x + b2.width < b1.x ||
      b2.y > b1.y + b1.height ||
      b2.y + b2.height < b1.y
    );
  }

  getShapesInMarquee(marqueeBounds: Bounds, allShapes: Tool[]): Tool[] {
    return allShapes.filter(shape => {
      const shapeBounds = this.getShapeBounds(shape);
      return this.doBoundsIntersect(shapeBounds, marqueeBounds);
    });
  }


  isPointInShape(x: number, y: number, shape: Tool): boolean {
    const bounds = this.getShapeBounds(shape);
    return (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    );
  }

  isPointInCombinedBounds(x: number, y: number): boolean {
      const bounds = this.getCombinedBounds();
      if (!bounds) return false;
      return (
          x >= bounds.x &&
          x <= bounds.x + bounds.width &&
          y >= bounds.y &&
          y <= bounds.y + bounds.height
      );
  }

  getResizeHandleAtPoint(x: number, y: number): ResizeHandle | null {
    const bounds = this.getCombinedBounds();
    if (!bounds) return null;
    
    const handles = this.getResizeHandles(bounds);
    const handleRadius = 5;

    return (
      handles.find((handle) => {
        const dx = x - handle.x;
        const dy = y - handle.y;
        return dx * dx + dy * dy <= handleRadius * handleRadius;
      }) || null
    );
  }

  startDragging(x: number, y: number) {
    if (this.selectedShapes.length > 0) {
      this.isDragging = true;
      const bounds = this.getCombinedBounds()!;
      this.dragOffset = { x: x - bounds.x, y: y - bounds.y };
      
      this.originalShapeStates.clear();
      this.selectedShapes.forEach(shape => {
          if (shape.id) this.originalShapeStates.set(shape.id, JSON.parse(JSON.stringify(shape)));
      });

      this.setCursor("move");
    }
  }

  startResizing(x: number, y: number) {
    if (this.selectedShapes.length > 0) {
      const handle = this.getResizeHandleAtPoint(x, y);

      if (handle) {
        this.isResizing = true;
        this.activeResizeHandle = handle;
        this.originalCombinedBounds = { ...this.getCombinedBounds()! };
        
        this.originalShapeStates.clear();
        this.selectedShapes.forEach(shape => {
            if (shape.id) this.originalShapeStates.set(shape.id, JSON.parse(JSON.stringify(shape)));
        });

        this.setCursor(handle.cursor);
      }
    }
  }

  updateDragging(x: number, y: number, existingShapes?: Tool[]) {
    if (this.isDragging && this.selectedShapes.length > 0) {
      const bounds = this.getCombinedBounds()!;
      
      let targetX = this.getSnappedPoint(x - this.dragOffset.x);
      let targetY = this.getSnappedPoint(y - this.dragOffset.y);
      
      this.activeSnapLines = [];

      // Smart object-to-object snapping
      if (this.isSmartSnapping && existingShapes && !this.isSnapToGrid) {
          const threshold = 5;
          let minSnapDx = threshold + 1;
          let minSnapDy = threshold + 1;
          let snappedXLine: number | undefined;
          let snappedYLine: number | undefined;
          
          const draggedCenter = { x: targetX + bounds.width / 2, y: targetY + bounds.height / 2 };
          const draggedRight = targetX + bounds.width;
          const draggedBottom = targetY + bounds.height;

          const nonSelectedShapes = existingShapes.filter(s => !this.selectedShapes.find(sel => sel.id === s.id));

          for (const shape of nonSelectedShapes) {
              const sBounds = this.getShapeBounds(shape);
              if (sBounds.width === 0 && sBounds.height === 0) continue;

              const sCenter = { x: sBounds.x + sBounds.width / 2, y: sBounds.y + sBounds.height / 2 };
              const sRight = sBounds.x + sBounds.width;
              const sBottom = sBounds.y + sBounds.height;

              // Check X-axis snapping
              const xPoints = [
                  { t: targetX, s: sBounds.x, line: sBounds.x, offset: 0 },
                  { t: targetX, s: sRight, line: sRight, offset: 0 },
                  { t: draggedRight, s: sBounds.x, line: sBounds.x, offset: -bounds.width },
                  { t: draggedRight, s: sRight, line: sRight, offset: -bounds.width },
                  { t: draggedCenter.x, s: sCenter.x, line: sCenter.x, offset: -bounds.width / 2 }
              ];

              for (const pt of xPoints) {
                  const dist = Math.abs(pt.t - pt.s);
                  if (dist < threshold && dist < minSnapDx) {
                      minSnapDx = dist;
                      targetX = pt.s + pt.offset;
                      snappedXLine = pt.line;
                  }
              }

              // Check Y-axis snapping
              const yPoints = [
                  { t: targetY, s: sBounds.y, line: sBounds.y, offset: 0 },
                  { t: targetY, s: sBottom, line: sBottom, offset: 0 },
                  { t: draggedBottom, s: sBounds.y, line: sBounds.y, offset: -bounds.height },
                  { t: draggedBottom, s: sBottom, line: sBottom, offset: -bounds.height },
                  { t: draggedCenter.y, s: sCenter.y, line: sCenter.y, offset: -bounds.height / 2 }
              ];

              for (const pt of yPoints) {
                  const dist = Math.abs(pt.t - pt.s);
                  if (dist < threshold && dist < minSnapDy) {
                      minSnapDy = dist;
                      targetY = pt.s + pt.offset;
                      snappedYLine = pt.line;
                  }
              }
          }
          
          if (snappedXLine !== undefined) this.activeSnapLines.push({ x: snappedXLine });
          if (snappedYLine !== undefined) this.activeSnapLines.push({ y: snappedYLine });
      }

      const dx = targetX - bounds.x;
      const dy = targetY - bounds.y;

      if (dx === 0 && dy === 0) return;

      const shapesToMove = new Set<Tool>(this.selectedShapes);

      // Add children of any selected frames
      if (existingShapes) {
          this.selectedShapes.forEach(selected => {
              if (selected.type === 'frame') {
                  const frameBounds = this.getShapeBounds(selected);
                  existingShapes.forEach(shape => {
                      if (shape.id === selected.id) return;
                      const shapeBounds = this.getShapeBounds(shape);
                      const centerX = shapeBounds.x + shapeBounds.width / 2;
                      const centerY = shapeBounds.y + shapeBounds.height / 2;
                      if (
                          centerX >= frameBounds.x &&
                          centerX <= frameBounds.x + frameBounds.width &&
                          centerY >= frameBounds.y &&
                          centerY <= frameBounds.y + frameBounds.height
                      ) {
                          shapesToMove.add(shape);
                      }
                  });
              }
          });
      }

      shapesToMove.forEach(shape => {
          this.applyOffsetToShape(shape, dx, dy);
      });

      this.triggerUpdate();
      if (this.onLiveUpdateCallback) {
        this.onLiveUpdateCallback(this.selectedShapes);
      }
      this.onDragOrResizeCursorMove?.(x, y);
    }
  }

  public applyOffsetToShape(shape: Tool, dx: number, dy: number) {
      if (dx === 0 && dy === 0) return;
      if (shape.type === 'line' || shape.type === 'arrow') {
          shape.x += dx;
          shape.y += dy;
          shape.toX += dx;
          shape.toY += dy;
      } else if (shape.type === 'free-draw' && Array.isArray(shape.points)) {
          shape.points.forEach((p: { x: number; y: number }) => {
              p.x += dx;
              p.y += dy;
          });
      } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (shape as any).x += dx;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (shape as any).y += dy;
      }
  }


  updateResizing(x: number, y: number) {
    if (
      this.isResizing &&
      this.selectedShapes.length > 0 &&
      this.activeResizeHandle &&
      this.originalCombinedBounds
    ) {
      const newBounds = { ...this.originalCombinedBounds };
      this.setCursor(this.activeResizeHandle.cursor);
      const snappedX = this.getSnappedPoint(x);
      const snappedY = this.getSnappedPoint(y);
      
      switch (this.activeResizeHandle.position) {
        case "top-left":
          newBounds.width += newBounds.x - snappedX;
          newBounds.height += newBounds.y - snappedY;
          newBounds.x = snappedX;
          newBounds.y = snappedY;
          break;
        case "top-right":
          newBounds.width = snappedX - newBounds.x;
          newBounds.height += newBounds.y - snappedY;
          newBounds.y = snappedY;
          break;
        case "bottom-left":
          newBounds.width += newBounds.x - snappedX;
          newBounds.height = snappedY - newBounds.y;
          newBounds.x = snappedX;
          break;
        case "bottom-right":
          newBounds.width = snappedX - newBounds.x;
          newBounds.height = snappedY - newBounds.y;
          break;
      }
      
      if (newBounds.width < 10) newBounds.width = 10;
      if (newBounds.height < 10) newBounds.height = 10;

      const scaleX = newBounds.width / this.originalCombinedBounds.width;
      const scaleY = newBounds.height / this.originalCombinedBounds.height;

      this.selectedShapes.forEach(shape => {
          const original = shape.id ? this.originalShapeStates.get(shape.id) : null;
          if (!original) return;

          if (shape.type === 'rectangle' || shape.type === 'sticky' || shape.type === 'image' || shape.type === 'text' || shape.type === 'frame' || shape.type === 'embed') {
              shape.x = newBounds.x + (original.x - this.originalCombinedBounds!.x) * scaleX;
              shape.y = newBounds.y + (original.y - this.originalCombinedBounds!.y) * scaleY;
              shape.width = original.width * scaleX;
              shape.height = original.height * scaleY;
          } else if (shape.type === 'ellipse') {
              shape.x = newBounds.x + (original.x - this.originalCombinedBounds!.x) * scaleX;
              shape.y = newBounds.y + (original.y - this.originalCombinedBounds!.y) * scaleY;
              shape.radX = original.radX * scaleX;
              shape.radY = original.radY * scaleY;
          } else if (shape.type === 'diamond') {
              shape.x = newBounds.x + (original.x - this.originalCombinedBounds!.x) * scaleX;
              shape.y = newBounds.y + (original.y - this.originalCombinedBounds!.y) * scaleY;
              shape.width = original.width * scaleX;
              shape.height = original.height * scaleY;
          } else if (shape.type === 'line' || shape.type === 'arrow') {
              shape.x = newBounds.x + (original.x - this.originalCombinedBounds!.x) * scaleX;
              shape.y = newBounds.y + (original.y - this.originalCombinedBounds!.y) * scaleY;
              shape.toX = newBounds.x + (original.toX - this.originalCombinedBounds!.x) * scaleX;
              shape.toY = newBounds.y + (original.toY - this.originalCombinedBounds!.y) * scaleY;
          } else if (shape.type === 'free-draw') {
              shape.points = original.points.map((p: any) => ({
                  x: newBounds.x + (p.x - this.originalCombinedBounds!.x) * scaleX,
                  y: newBounds.y + (p.y - this.originalCombinedBounds!.y) * scaleY
              }));
          }
      });

      this.triggerUpdate();
      if (this.onLiveUpdateCallback) {
        this.onLiveUpdateCallback(this.selectedShapes);
      }
      this.onDragOrResizeCursorMove?.(x, y);
    }
  }

  getShapesInLasso(lassoPoints: {x: number, y: number}[], existingShapes: Tool[]): Tool[] {
    const isPointInPolygon = (point: {x: number, y: number}, vs: {x: number, y: number}[]) => {
      let x = point.x, y = point.y;
      let inside = false;
      for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
          let xi = vs[i].x, yi = vs[i].y;
          let xj = vs[j].x, yj = vs[j].y;
          let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
      }
      return inside;
    };

    return existingShapes.filter(shape => {
      let bounds;
      if (shape.type === 'free-draw' && Array.isArray(shape.points)) {
          const xs = shape.points.map((p: any) => p.x);
          const ys = shape.points.map((p: any) => p.y);
          bounds = {
              x: Math.min(...xs),
              y: Math.min(...ys),
              width: Math.max(...xs) - Math.min(...xs),
              height: Math.max(...ys) - Math.min(...ys)
          };
      } else if (shape.type === 'line' || shape.type === 'arrow') {
          bounds = {
              x: Math.min(shape.x, shape.toX!),
              y: Math.min(shape.y, shape.toY!),
              width: Math.abs(shape.toX! - shape.x),
              height: Math.abs(shape.toY! - shape.y)
          };
      } else if (shape.type === 'ellipse') {
          bounds = {
              x: shape.x - shape.radX!,
              y: shape.y - shape.radY!,
              width: shape.radX! * 2,
              height: shape.radY! * 2
          };
      } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = shape as any;
          bounds = {
              x: s.x,
              y: s.y,
              width: s.width || 0,
              height: s.height || 0
          };
      }

      const center = {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2
      };

      return isPointInPolygon(center, lassoPoints);
    });
  }

  stopDragging() {
    this.isDragging = false;
    this.resetCursor();
    this.originalShapeStates.clear();
    this.activeSnapLines = [];
  }

  stopResizing() {
    this.isResizing = false;
    this.activeResizeHandle = null;
    this.originalCombinedBounds = null;
    this.resetCursor();
    this.originalShapeStates.clear();
  }
}
