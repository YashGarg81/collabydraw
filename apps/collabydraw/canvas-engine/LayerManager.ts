import * as Y from "yjs";
import { Shape } from "@/types/canvas";

// ─────────────────────────────────────────────────────────────
// Layer Types
// ─────────────────────────────────────────────────────────────

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /**
   * Fractional ordering string (e.g., "a0", "a1", "a2").
   * Using string ordering prevents CRDT integer conflicts when two clients
   * reorder layers simultaneously. Conceptually like Figma's layer ordering.
   * In production, use the `fractional-indexing` npm package.
   */
  order: string;
}

// ─────────────────────────────────────────────────────────────
// LayerManager
// ─────────────────────────────────────────────────────────────

const DEFAULT_LAYER_ID = "default";
const DEFAULT_LAYER: Layer = {
  id: DEFAULT_LAYER_ID,
  name: "Layer 1",
  visible: true,
  locked: false,
  order: "a0",
};

/**
 * Phase 6: LayerManager
 *
 * Architecture contracts:
 *   - Layers are stored in a `Y.Map<Layer>` ("layers") for CRDT sync.
 *   - Shapes reference layers via `shape.layerId`. Omitted = default layer.
 *   - Rendering pipeline reads LayerManager to:
 *       1. Filter out hidden shapes before drawing.
 *       2. Sort shapes by layer order (ascending) + shape zIndex.
 *   - Hit testing skips locked layers.
 *   - All mutations are single-property Yjs updates for minimal CRDT traffic.
 *   - Default layer is always present and cannot be deleted.
 */
export class LayerManager {
  private yLayers: Y.Map<Layer>;
  private doc: Y.Doc;
  private localOrigin: string;

  /** React-side change callback — called whenever layers are modified */
  public onChange: ((layers: Layer[]) => void) | null = null;

  constructor(doc: Y.Doc, localOrigin: string) {
    this.doc = doc;
    this.localOrigin = localOrigin;
    this.yLayers = doc.getMap<Layer>("layers");

    // Ensure a default layer always exists
    if (!this.yLayers.has(DEFAULT_LAYER_ID)) {
      this.yLayers.set(DEFAULT_LAYER_ID, DEFAULT_LAYER);
    }

    this.yLayers.observe(() => this.notify());
  }

  // ─────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────

  public getLayers(): Layer[] {
    const layers: Layer[] = [];
    this.yLayers.forEach(l => layers.push(l));
    return layers.sort((a, b) => a.order.localeCompare(b.order));
  }

  public getLayer(id: string): Layer | undefined {
    return this.yLayers.get(id);
  }

  public getDefaultLayer(): Layer {
    return this.yLayers.get(DEFAULT_LAYER_ID)!;
  }

  /** Returns the layerId for a shape, defaulting to the default layer */
  public resolveLayerId(shape: Shape): string {
    const s = shape as any;
    return s.layerId ?? DEFAULT_LAYER_ID;
  }

  // ─────────────────────────────────────────────
  // Shape filtering (for renderer)
  // ─────────────────────────────────────────────

  /**
   * Filter and sort shapes according to layer visibility and order.
   * Called by CanvasEngine.clearCanvas() before iterating shapesToRender.
   */
  public filterAndSort(shapes: Shape[]): Shape[] {
    const hiddenLayerIds = new Set<string>();
    this.yLayers.forEach((l) => { if (!l.visible) hiddenLayerIds.add(l.id); });

    // Filter hidden-layer shapes
    const visible = shapes.filter(s => {
      const s_ = s as any;
      const layerId = s_.layerId ?? DEFAULT_LAYER_ID;
      if (hiddenLayerIds.has(layerId)) return false;
      if (s_.hidden === true) return false;
      return true;
    });

    // Sort by layer order, then shape zIndex
    return visible.sort((a, b) => {
      const la = this.yLayers.get((a as any).layerId ?? DEFAULT_LAYER_ID);
      const lb = this.yLayers.get((b as any).layerId ?? DEFAULT_LAYER_ID);
      const layerCmp = (la?.order ?? "a0").localeCompare(lb?.order ?? "a0");
      if (layerCmp !== 0) return layerCmp;
      return ((a as any).zIndex ?? 0) - ((b as any).zIndex ?? 0);
    });
  }

  /**
   * Returns true if a shape's layer is locked or the shape itself is locked.
   * Used by hit testing to prevent interaction with locked shapes.
   */
  public isShapeLocked(shape: Shape): boolean {
    const s = shape as any;
    if (s.locked === true) return true;
    const layer = this.yLayers.get(s.layerId ?? DEFAULT_LAYER_ID);
    return layer?.locked ?? false;
  }

  // ─────────────────────────────────────────────
  // Layer CRUD
  // ─────────────────────────────────────────────

  public createLayer(name: string): Layer {
    const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const layers = this.getLayers();
    const lastOrder = layers[layers.length - 1]?.order ?? "a0";
    const newOrder = this.incrementOrder(lastOrder);

    const layer: Layer = { id, name, visible: true, locked: false, order: newOrder };
    this.doc.transact(() => { this.yLayers.set(id, layer); }, this.localOrigin);
    return layer;
  }

  public renameLayer(id: string, name: string) {
    const existing = this.yLayers.get(id);
    if (!existing) return;
    this.doc.transact(() => { this.yLayers.set(id, { ...existing, name }); }, this.localOrigin);
  }

  public toggleVisibility(id: string) {
    const existing = this.yLayers.get(id);
    if (!existing) return;
    this.doc.transact(() => { this.yLayers.set(id, { ...existing, visible: !existing.visible }); }, this.localOrigin);
  }

  public toggleLock(id: string) {
    const existing = this.yLayers.get(id);
    if (!existing) return;
    this.doc.transact(() => { this.yLayers.set(id, { ...existing, locked: !existing.locked }); }, this.localOrigin);
  }

  /**
   * Delete a layer. Shapes on the deleted layer are moved to the default layer.
   * Cannot delete the default layer.
   */
  public deleteLayer(id: string, allShapes: Shape[], onShapeUpdate: (shape: Shape) => void) {
    if (id === DEFAULT_LAYER_ID) return;
    
    // Migrate orphan shapes to default layer
    allShapes.forEach(shape => {
      if ((shape as any).layerId === id) {
        (shape as any).layerId = DEFAULT_LAYER_ID;
        onShapeUpdate(shape);
      }
    });

    this.doc.transact(() => { this.yLayers.delete(id); }, this.localOrigin);
  }

  public moveShapeToLayer(shape: Shape, layerId: string, onShapeUpdate: (shape: Shape) => void) {
    if (!this.yLayers.has(layerId)) return;
    (shape as any).layerId = layerId;
    onShapeUpdate(shape);
  }

  // ─────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────

  private notify() {
    this.onChange?.(this.getLayers());
  }

  /**
   * Minimal fractional order increment: "a0" → "a1" → ... → "a9" → "b0"
   * For production: replace with the `fractional-indexing` npm package.
   */
  private incrementOrder(order: string): string {
    const prefix = order.slice(0, -1);
    const suffix = parseInt(order.slice(-1));
    if (suffix < 9) return prefix + (suffix + 1);
    return String.fromCharCode(prefix.charCodeAt(0) + 1) + "0";
  }
}
