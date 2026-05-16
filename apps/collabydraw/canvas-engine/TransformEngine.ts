import { Point, Shape } from "@/types/canvas";

export class TransformEngine {
  /**
   * Rotate a point around a given center by an angle (in radians)
   */
  public static rotatePoint(point: Point, center: Point, angle: number): Point {
    if (!angle) return point;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // Math reference:
    // x' = x*cos(q) - y*sin(q)
    // y' = x*sin(q) + y*cos(q)
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    
    return {
      x: center.x + (dx * cos - dy * sin),
      y: center.y + (dx * sin + dy * cos)
    };
  }

  /**
   * Get the absolute center point of a shape
   */
  public static getShapeCenter(shape: Shape): Point {
    const s = shape as any;
    
    // If a custom transform origin is provided (0 to 1), calculate based on that
    if (s.transformOrigin && s.width !== undefined && s.height !== undefined) {
      return {
        x: s.x + (s.width * s.transformOrigin.x),
        y: s.y + (s.height * s.transformOrigin.y)
      };
    }

    if (s.type === 'ellipse' && s.radX && s.radY) {
      return { x: s.x, y: s.y };
    } else if (s.type === 'free-draw' && s.points && s.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      s.points.forEach((p: Point) => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      });
      return { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
    } else if (s.width !== undefined && s.height !== undefined) {
      return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
    } else if (s.toX !== undefined && s.toY !== undefined) {
      return { x: s.x + (s.toX - s.x) / 2, y: s.y + (s.toY - s.y) / 2 };
    }
    
    return { x: s.x || 0, y: s.y || 0 };
  }

  /**
   * Applies a given rotation context to the Canvas 2D
   */
  public static applyTransform(ctx: CanvasRenderingContext2D, shape: Shape) {
    if (!shape.rotation) return;
    const center = this.getShapeCenter(shape);
    ctx.translate(center.x, center.y);
    ctx.rotate(shape.rotation);
    ctx.translate(-center.x, -center.y);
  }

  /**
   * Calculates the rotated Axis-Aligned Bounding Box (AABB) for spatial indexing
   */
  public static getRotatedAABB(
    minX: number, minY: number, maxX: number, maxY: number, 
    shape: Shape
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    if (!shape.rotation) return { minX, minY, maxX, maxY };

    const center = this.getShapeCenter(shape);
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ].map(p => this.rotatePoint(p, center, shape.rotation!));

    let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
    corners.forEach(c => {
      rMinX = Math.min(rMinX, c.x);
      rMinY = Math.min(rMinY, c.y);
      rMaxX = Math.max(rMaxX, c.x);
      rMaxY = Math.max(rMaxY, c.y);
    });

    return { minX: rMinX, minY: rMinY, maxX: rMaxX, maxY: rMaxY };
  }

  /**
   * Inverse transforms a screen/world point into the shape's local coordinate space
   * Useful for hit testing rotated shapes
   */
  public static worldToLocal(point: Point, shape: Shape): Point {
    if (!shape.rotation) return point;
    const center = this.getShapeCenter(shape);
    // Inverse rotation is just rotating by negative angle
    return this.rotatePoint(point, center, -shape.rotation);
  }
}
