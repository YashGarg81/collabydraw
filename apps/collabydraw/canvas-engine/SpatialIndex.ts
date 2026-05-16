import RBush from "rbush";
import { Shape } from "@/types/canvas";
import { TransformEngine } from "./TransformEngine";

export interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  shape: Shape;
}

export class SpatialIndex extends RBush<SpatialItem> {
  // Extract bounding box logic to be reused
  public static getBounds(shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const strokeW = 'strokeWidth' in shape ? (shape as any).strokeWidth : 1;
    const padding = (strokeW || 1) * 2 + 10; // Extra padding for selection/handles

    if (shape.type === 'free-draw' && shape.points) {
      shape.points.forEach(p => {
        minX = Math.min(minX, p.x - padding);
        minY = Math.min(minY, p.y - padding);
        maxX = Math.max(maxX, p.x + padding);
        maxY = Math.max(maxY, p.y + padding);
      });
    } else {
      const s = shape as any;
      if (s.x === undefined || s.y === undefined) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

      let x2 = s.x + (s.width || 0);
      let y2 = s.y + (s.height || 0);
      
      if (s.type === 'ellipse' && s.radX && s.radY) {
        x2 = s.x + s.radX;
        y2 = s.y + s.radY;
        minX = Math.min(minX, s.x - s.radX - padding);
        minY = Math.min(minY, s.y - s.radY - padding);
      } else if (s.toX !== undefined && s.toY !== undefined) {
        x2 = s.toX;
        y2 = s.toY;
        minX = Math.min(minX, s.x - padding, s.toX - padding);
        minY = Math.min(minY, s.y - padding, s.toY - padding);
      } else {
        minX = Math.min(minX, s.x - padding);
        minY = Math.min(minY, s.y - padding);
      }
      maxX = Math.max(maxX, x2 + padding);
      maxY = Math.max(maxY, y2 + padding);
    }
    
    // Fallback if width/height is 0
    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    // Support rotated bounding boxes
    return TransformEngine.getRotatedAABB(minX, minY, maxX, maxY, shape);
  }

  public updateIndex(shapes: Shape[]) {
    this.clear();
    const items = shapes.map(shape => {
      const bounds = SpatialIndex.getBounds(shape);
      return { ...bounds, shape };
    });
    this.load(items);
  }

  public getVisibleShapes(viewportBounds: { minX: number; minY: number; maxX: number; maxY: number }): Shape[] {
    return this.search(viewportBounds).map(item => item.shape);
  }
}
