import { Point, Shape } from "@/types/canvas";
import { TransformEngine } from "./TransformEngine";
import { Bounds } from "./SelectionController";

export interface GroupDescriptor {
  groupId: string;
  /** center of the group in world space at the time of grouping */
  centerX: number;
  centerY: number;
  rotation: number;
}

/**
 * Phase 3: GroupManager
 *
 * Manages the parent-child hierarchy for shape groups.
 * Architecture contract:
 *   - Groups are identified by a shared `groupId` on their member shapes.
 *   - A "virtual group" has no own Shape node; the group transform is stored
 *     in a separate `groupDescriptors` map so it can be sync'd via Yjs
 *     without polluting the shape data model.
 *   - Child shapes ALWAYS store their own world-space coordinates.
 *     Group moves update ALL children atomically via Yjs transactions.
 *     This avoids the complexity of parent-relative coordinate storage and
 *     keeps the rendering pipeline flat and backward compatible.
 */
export class GroupManager {
  // Map of groupId → descriptor (stored separately in Y.Map for Yjs sync)
  private descriptors: Map<string, GroupDescriptor> = new Map();

  // ─────────────────────────────────────────────
  // Descriptor management (Yjs sync surface)
  // ─────────────────────────────────────────────

  public setDescriptor(descriptor: GroupDescriptor) {
    this.descriptors.set(descriptor.groupId, descriptor);
  }

  public getDescriptor(groupId: string): GroupDescriptor | undefined {
    return this.descriptors.get(groupId);
  }

  public removeDescriptor(groupId: string) {
    this.descriptors.delete(groupId);
  }

  public allDescriptors(): GroupDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  // ─────────────────────────────────────────────
  // Hierarchy queries
  // ─────────────────────────────────────────────

  /** Returns the root groupId for a given groupId (for future nested group support) */
  public resolveRootGroup(groupId: string, allShapes: Shape[]): string {
    // Currently flat grouping — returns itself.
    // Future: traverse parent groupId chain upwards.
    return groupId;
  }

  /** 
   * Resolve which shapes should be selected when a user clicks `clickedShape`.
   * If shape is in a group, return ALL group members.
   * Prevents partial group selections by default.
   */
  public resolveSelection(clickedShape: Shape, allShapes: Shape[]): Shape[] {
    if (!clickedShape.groupId) return [clickedShape];
    const rootGroupId = this.resolveRootGroup(clickedShape.groupId, allShapes);
    return allShapes.filter(s => s.groupId === rootGroupId);
  }

  /** Returns all shapes belonging to a groupId */
  public getMembersOf(groupId: string, allShapes: Shape[]): Shape[] {
    return allShapes.filter(s => s.groupId === groupId);
  }

  // ─────────────────────────────────────────────
  // Bounding box calculation
  // ─────────────────────────────────────────────

  /**
   * Calculate the combined world-space AABB of all members of a group.
   * Used for:
   *  - Spatial index updates
   *  - Group selection box drawing
   *  - Group transform origin computation
   */
  public getGroupBounds(groupId: string, allShapes: Shape[]): Bounds | null {
    const members = this.getMembersOf(groupId, allShapes);
    if (members.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const padding = 8;

    members.forEach(shape => {
      const b = this.getShapeWorldBounds(shape);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    });

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };
  }

  /** Get world-space AABB for a single shape (accounts for rotation) */
  public getShapeWorldBounds(shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } {
    const s = shape as any;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (s.type === 'ellipse' && s.radX && s.radY) {
      minX = s.x - s.radX; minY = s.y - s.radY;
      maxX = s.x + s.radX; maxY = s.y + s.radY;
    } else if (s.type === 'free-draw' && s.points) {
      s.points.forEach((p: Point) => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      });
    } else if (s.toX !== undefined) {
      minX = Math.min(s.x, s.toX); maxX = Math.max(s.x, s.toX);
      minY = Math.min(s.y, s.toY); maxY = Math.max(s.y, s.toY);
    } else {
      minX = s.x; minY = s.y;
      maxX = s.x + (s.width || 0);
      maxY = s.y + (s.height || 0);
    }

    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    // Apply rotation AABB expansion
    if (shape.rotation) {
      return TransformEngine.getRotatedAABB(minX, minY, maxX, maxY, shape);
    }
    return { minX, minY, maxX, maxY };
  }

  // ─────────────────────────────────────────────
  // Transform composition
  // ─────────────────────────────────────────────

  /**
   * Moves all members of a group by (dx, dy) in world space.
   * Children maintain their world coords; this is a bulk coordinate mutation.
   * Caller is responsible for wrapping in a Yjs transaction.
   */
  public applyGroupTranslation(groupId: string, allShapes: Shape[], dx: number, dy: number) {
    const members = this.getMembersOf(groupId, allShapes);
    members.forEach(shape => this.applyTranslationToShape(shape, dx, dy));

    // Update group descriptor center
    const desc = this.descriptors.get(groupId);
    if (desc) {
      desc.centerX += dx;
      desc.centerY += dy;
    }
  }

  /**
   * Rotates all members of a group around the group center in world space.
   * Each child's (x, y) is recalculated in world space after the rotation.
   * Caller is responsible for wrapping in a Yjs transaction.
   */
  public applyGroupRotation(
    groupId: string,
    allShapes: Shape[],
    deltaAngle: number
  ) {
    const bounds = this.getGroupBounds(groupId, allShapes);
    if (!bounds) return;

    const center: Point = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };

    const members = this.getMembersOf(groupId, allShapes);
    members.forEach(shape => {
      // Rotate shape's anchor point around group center
      const anchor = TransformEngine.getShapeCenter(shape);
      const rotated = TransformEngine.rotatePoint(anchor, center, deltaAngle);
      const dX = rotated.x - anchor.x;
      const dY = rotated.y - anchor.y;

      this.applyTranslationToShape(shape, dX, dY);
      // Compose rotation
      (shape as any).rotation = ((shape.rotation || 0) + deltaAngle) % (Math.PI * 2);
    });

    // Update group descriptor rotation
    const desc = this.descriptors.get(groupId);
    if (desc) {
      desc.rotation = (desc.rotation + deltaAngle) % (Math.PI * 2);
    }
  }

  // ─────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────

  private applyTranslationToShape(shape: Shape, dx: number, dy: number) {
    const s = shape as any;
    if (s.type === 'line' || s.type === 'arrow') {
      s.x += dx; s.y += dy; s.toX += dx; s.toY += dy;
    } else if (s.type === 'free-draw' && Array.isArray(s.points)) {
      s.points.forEach((p: Point) => { p.x += dx; p.y += dy; });
    } else {
      s.x += dx; s.y += dy;
    }
  }

  // ─────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────

  /**
   * Checks for cyclic groupId references in nested groups (future-proofing).
   * Returns true if the hierarchy is valid (no cycles detected).
   */
  public validateHierarchy(allShapes: Shape[]): boolean {
    const groupIds = new Set(allShapes.map(s => s.groupId).filter(Boolean) as string[]);
    // Currently flat — all group IDs are terminal. For nested groups,
    // implement DFS cycle detection here.
    return groupIds.size >= 0; // always valid in flat model
  }
}
