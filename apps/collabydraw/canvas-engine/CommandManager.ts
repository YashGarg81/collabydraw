import * as Y from "yjs";
import { Shape } from "@/types/canvas";

// ─────────────────────────────────────────────────────────────
// Command Interface
// ─────────────────────────────────────────────────────────────

export interface Command {
  readonly label: string;
  execute(yShapes: Y.Map<Shape>, yOrder: Y.Array<string>, doc: Y.Doc, origin: string): void;
  undo(yShapes: Y.Map<Shape>, yOrder: Y.Array<string>, doc: Y.Doc, origin: string): void;
}

// ─────────────────────────────────────────────────────────────
// Concrete Commands
// ─────────────────────────────────────────────────────────────

export class AddShapeCommand implements Command {
  readonly label = "Add Shape";
  constructor(private shape: Shape) {}

  execute(yShapes: Y.Map<Shape>, yOrder: Y.Array<string>, doc: Y.Doc, origin: string) {
    doc.transact(() => {
      if (this.shape.id) {
        yShapes.set(this.shape.id, this.shape);
        if (!yOrder.toArray().includes(this.shape.id)) {
          yOrder.push([this.shape.id!]);
        }
      }
    }, origin);
  }

  undo(yShapes: Y.Map<Shape>, yOrder: Y.Array<string>, doc: Y.Doc, origin: string) {
    doc.transact(() => {
      if (this.shape.id) {
        yShapes.delete(this.shape.id);
        const arr = yOrder.toArray();
        const idx = arr.indexOf(this.shape.id);
        if (idx !== -1) yOrder.delete(idx, 1);
      }
    }, origin);
  }
}

export class RemoveShapeCommand implements Command {
  readonly label = "Remove Shape";
  private orderIndex: number = -1;
  
  constructor(private shape: Shape, orderIndex?: number) {
    this.orderIndex = orderIndex ?? -1;
  }

  execute(yShapes: Y.Map<Shape>, yOrder: Y.Array<string>, doc: Y.Doc, origin: string) {
    doc.transact(() => {
      if (this.shape.id) {
        const arr = yOrder.toArray();
        this.orderIndex = arr.indexOf(this.shape.id);
        yShapes.delete(this.shape.id);
        if (this.orderIndex !== -1) yOrder.delete(this.orderIndex, 1);
      }
    }, origin);
  }

  undo(yShapes: Y.Map<Shape>, yOrder: Y.Array<string>, doc: Y.Doc, origin: string) {
    doc.transact(() => {
      if (this.shape.id) {
        yShapes.set(this.shape.id, this.shape);
        if (this.orderIndex !== -1 && this.orderIndex <= yOrder.length) {
          yOrder.insert(this.orderIndex, [this.shape.id]);
        } else {
          yOrder.push([this.shape.id!]);
        }
      }
    }, origin);
  }
}

export class UpdateShapeCommand implements Command {
  readonly label = "Update Shape";
  constructor(
    private prev: Shape,
    private next: Shape
  ) {}

  execute(yShapes: Y.Map<Shape>, _yOrder: Y.Array<string>, doc: Y.Doc, origin: string) {
    doc.transact(() => {
      if (this.next.id) yShapes.set(this.next.id, this.next);
    }, origin);
  }

  undo(yShapes: Y.Map<Shape>, _yOrder: Y.Array<string>, doc: Y.Doc, origin: string) {
    doc.transact(() => {
      if (this.prev.id) yShapes.set(this.prev.id, this.prev);
    }, origin);
  }
}

/**
 * BatchCommand: wraps multiple commands into a single atomic undo/redo step.
 * Used for: group operations, multi-shape moves, paste, etc.
 */
export class BatchCommand implements Command {
  readonly label: string;
  constructor(label: string, private commands: Command[]) {
    this.label = label;
  }

  execute(yShapes: Y.Map<Shape>, yOrder: Y.Array<string>, doc: Y.Doc, origin: string) {
    doc.transact(() => {
      this.commands.forEach(cmd => cmd.execute(yShapes, yOrder, doc, origin));
    }, origin);
  }

  undo(yShapes: Y.Map<Shape>, yOrder: Y.Array<string>, doc: Y.Doc, origin: string) {
    doc.transact(() => {
      // Undo in reverse order
      [...this.commands].reverse().forEach(cmd => cmd.undo(yShapes, yOrder, doc, origin));
    }, origin);
  }
}

// ─────────────────────────────────────────────────────────────
// CommandManager
// ─────────────────────────────────────────────────────────────

/**
 * Phase 5: CommandManager
 *
 * Replaces ad-hoc Yjs mutation with a formal Command Pattern history stack.
 *
 * Architecture contracts:
 *   - All history is LOCAL (one stack per client).
 *   - Remote operations are NEVER tracked in the local undo stack.
 *     This is enforced by using the Y.UndoManager's `trackedOrigins` — only
 *     actions with `origin === this.localOrigin` are tracked.
 *   - The CommandManager is used for NEW operations. Legacy callers that
 *     use _addShapeToCRDT / _removeShapeFromCRDT directly are backward-
 *     compatible because Y.UndoManager tracks all local-origin transactions.
 *   - Batch transactions using BatchCommand to group multi-step operations
 *     into a single undo step (e.g., group, paste, align).
 */
export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxHistory = 200;

  /** Called by CanvasEngine to expose undo/redo availability to UI */
  public onChange: ((canUndo: boolean, canRedo: boolean) => void) | null = null;

  constructor(
    private yShapes: Y.Map<Shape>,
    private yOrder: Y.Array<string>,
    private doc: Y.Doc,
    private localOrigin: string
  ) {}

  /** Execute a command and push to undo stack */
  public execute(cmd: Command) {
    cmd.execute(this.yShapes, this.yOrder, this.doc, this.localOrigin);
    this.undoStack.push(cmd);
    this.redoStack = []; // Clear redo on new action

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notify();
  }

  /** Undo the last command */
  public undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo(this.yShapes, this.yOrder, this.doc, this.localOrigin);
    this.redoStack.push(cmd);
    this.notify();
  }

  /** Redo the last undone command */
  public redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute(this.yShapes, this.yOrder, this.doc, this.localOrigin);
    this.undoStack.push(cmd);
    this.notify();
  }

  public get canUndo(): boolean { return this.undoStack.length > 0; }
  public get canRedo(): boolean { return this.redoStack.length > 0; }

  public get undoLabel(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.label;
  }

  public get redoLabel(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.label;
  }

  private notify() {
    this.onChange?.(this.canUndo, this.canRedo);
  }
}
