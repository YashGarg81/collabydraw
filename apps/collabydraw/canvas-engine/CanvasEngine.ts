import {
  FillStyle,
  FONT_SIZE_MAP,
  FontFamily,
  FontSize,
  FontStyle,
  RoughStyle,
  Shape,
  StrokeEdge,
  StrokeStyle,
  StrokeWidth,
  TextAlign,
  ToolType,
} from "@/types/canvas";
import { getCollaboratorColor, type CursorState } from "@/utils/collaboratorUtils";
import { TransformEngine } from "./TransformEngine";
import { SelectionController } from "./SelectionController";
import { v4 as uuidv4 } from "uuid";
import * as Y from "yjs";
import {
  RoomParticipants,
  WebSocketMessage,
  WsDataType,
} from "@repo/common/types";
import {
  ARROW_HEAD_LENGTH,
  COLOR_CHARCOAL_BLACK,
  COLOR_WHITE,
  DEFAULT_BG_FILL,
  DEFAULT_STROKE_FILL,
  DEFAULT_STROKE_WIDTH,
  DIAMOND_CORNER_RADIUS_PERCENTAGE,
  ERASER_TOLERANCE,
  getDashArrayDashed,
  getDashArrayDotted,
  RECT_CORNER_RADIUS_FACTOR,
  ROUND_RADIUS_FACTOR,
  TEXT_ADJUSTED_HEIGHT,
  WS_URL,
} from "@/config/constants";
import { MessageQueue } from "./MessageQueue";
import { decryptData, encryptData } from "@/utils/crypto";

import rough from "roughjs/bin/rough";
import { RoughCanvas } from "roughjs/bin/canvas";
import { Options } from "roughjs/bin/core";
import type { Point } from "roughjs/bin/geometry";

import { getFontSize, getLineHeight } from "@/utils/textUtils";
import { generateFreeDrawPath } from "../shape-render/RenderElements";
import { roundRect } from "@/shape-render/roundRect";
import { getClientColor } from "@/utils/getClientColor";
import { getStreamKey } from "@/utils/getStreamKey";
import { SpatialIndex } from "./SpatialIndex";
import { GroupManager, GroupDescriptor } from "./GroupManager";
import { SnapEngine } from "./SnapEngine";
import { CommandManager, AddShapeCommand, RemoveShapeCommand, UpdateShapeCommand, BatchCommand } from "./CommandManager";
import { LayerManager, Layer } from "./LayerManager";

type WebSocketConnection = {
  connectionId: string;
  connected: boolean;
};

// NOTE: Comments in this Canvas Engine are not AI generated. This are for my personal understanding.
export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private roughCanvas: RoughCanvas;
  private roomId: string | null;
  private userId: string | null;
  private userName: string | null;
  private token: string | null;
  private canvasBgColor: string;
  private isStandalone: boolean = false;
  private onScaleChangeCallback: (scale: number) => void;
  private onParticipantsUpdate:
    | ((participants: RoomParticipants[]) => void)
    | null;
  private onConnectionChange: ((isConnected: boolean) => void) | null;
  private onShapeCountChange: ((count: number) => void) | null = null;
  public setOnShapeCountChange(callback: (count: number) => void) {
    this.onShapeCountChange = callback;
  }

  private clicked: boolean;
  public outputScale: number = 1;
  private activeTool: ToolType = "grab";
  private startX: number = 0;
  private startY: number = 0;
  private panX: number = 0;
  private panY: number = 0;
  private scale: number = 1;
  private strokeWidth: StrokeWidth = 1;
  private strokeFill: string = "rgba(255, 255, 255)";
  private bgFill: string = "rgba(18, 18, 18)";
  private strokeEdge: StrokeEdge = "round";
  private strokeStyle: StrokeStyle = "solid";
  private roughStyle: RoughStyle = 1;
  private fillStyle: FillStyle = "solid";
  private fontFamily: FontFamily = "hand-drawn";
  private fontSize: FontSize = "Medium";
  private textAlign: TextAlign = "left";
  private fontStyle: FontStyle = "normal";

  private yDoc: Y.Doc;
  private yShapes: Y.Map<Shape>;
  private yOrder: Y.Array<string>;
  private yUndoManager: Y.UndoManager;
  private connectionId: string | null = null;
  private myConnections: { connectionId: string; connected: boolean }[] = [];
  private isDestroyed: boolean = false;
  public onHistoryChange: ((canUndo: boolean, canRedo: boolean) => void) | null = null;

  private isDraggingCanvas: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private isMarqueeSelecting: boolean = false;
  private marqueeStartX: number = 0;
  private marqueeStartY: number = 0;
  private marqueeCurrentX: number = 0;
  private marqueeCurrentY: number = 0;
  private hoveredShapeId: string | null = null;
  
  private SelectionController: SelectionController;
  private existingShapes: Shape[] = [];
  private spatialIndex: SpatialIndex = new SpatialIndex();
  private groupManager: GroupManager = new GroupManager();
  private snapEngine: SnapEngine = new SnapEngine();
  private commandManager!: CommandManager;  // Phase 5
  private layerManager!: LayerManager;      // Phase 6
  private yGroups!: Y.Map<GroupDescriptor>;

  public isSnapToGrid: boolean = false;
  
  public followUserId: string | null = null;
  public isReadOnly: boolean = false;
  
  public follow(userId: string | null) {
      this.followUserId = userId;
      if (userId === null) return;
      
      // Look for a known cursor immediately
      let foundCursor = false;
      this.remoteCursors.forEach((c) => {
          if (c.userId === userId) {
              this.panX = c.x - (this.canvas.width / 2) / this.scale;
              this.panY = c.y - (this.canvas.height / 2) / this.scale;
              foundCursor = true;
          }
      });
      if (foundCursor) {
          this.triggerViewChange();
          this.clearCanvas();
      }
  }

  public setSnapToGrid(snap: boolean) {
    this.isSnapToGrid = snap;
    this.SelectionController.isSnapToGrid = snap;
    this.snapEngine.config.gridEnabled = snap;
  }

  public setSmartSnapping(enabled: boolean) {
    this.SelectionController.isSmartSnapping = enabled;
    this.snapEngine.config.enabled = enabled;
  }

  public setGridSize(size: number) {
    this.snapEngine.config.gridSize = size;
  }

  public get snapConfig() {
    return this.snapEngine.config;
  }

  public setOnSelectionChange(cb: (isSelected: boolean, count?: number, isGrouped?: boolean) => void) {
    this.SelectionController.setOnSelectionChange(cb);
  }

  private socket: WebSocket | null = null;
  private isConnected = false;
  private participants: RoomParticipants[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private flushInterval: any;
  private encryptionKey: string | null;

  private roughSeed: number = 1;

  private streamingShapeId: string | null = null;
  private streamingThrottleTimeout: number | null = null;
  private streamingUpdateInterval: number = 50;
  private remoteStreamingShapes: Map<string, Shape> = new Map();

  private cursorThrottleTimeout: number | null = null;
  private remoteCursors: Map<string, CursorState> = new Map();
  private presenceAnimFrameId: number | null = null;
  private presenceLastTick: number = 0;
  /**
   * Stores timestamp of when a remote user last initiated a shape stream (i.e., clicked to draw).
   * Key format: `${userId}-${connectionId}`, value is timestamp (in ms).
   */
  private remoteClickIndicators: Map<string, number> = new Map();

  private currentTheme: "light" | "dark" | null = null;
  private onLiveUpdateFromSelection?: (shape: Shape) => void;

  private activeTextarea: HTMLTextAreaElement | null = null;
  private activeTextPosition: { x: number; y: number } | null = null;

  private imageCache: Map<string, HTMLImageElement> = new Map();

  // Wave 6: Laser & Lasso
  private laserStrokes: { points: { x: number; y: number; time: number }[]; strokeFill: string; connectionId?: string }[] = [];
  private laserAnimFrameId: number | null = null;
  private isLassoSelecting: boolean = false;
  private lassoPoints: { x: number; y: number }[] = [];

  public onViewChange?: (embeds: Shape[], panX: number, panY: number, scale: number) => void;
  public onToolChangeCallback?: (tool: ToolType) => void;
  // Phase 2: Persistence & Recovery
  public onDocumentChange?: () => void;
  public onCursorUpdate?: (userId: string, userName: string, x: number, y: number) => void;

  public triggerViewChange() {
      if (this.onViewChange) {
          const embeds = this.existingShapes.filter(s => s.type === 'embed');
          this.onViewChange(embeds, this.panX, this.panY, this.scale);
      }
  }

  constructor(
    canvas: HTMLCanvasElement,
    roomId: string | null,
    userId: string | null,
    userName: string | null,
    token: string | null,
    canvasBgColor: string,
    onScaleChangeCallback: (scale: number) => void,
    isStandalone: boolean = false,
    onParticipantsUpdate: ((participants: RoomParticipants[]) => void) | null,
    onConnectionChange: ((isConnected: boolean) => void) | null,
    encryptionKey: string | null,
    appTheme: "light" | "dark" | null
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is not available. Ensure the canvas is mounted and the browser supports HTMLCanvasElement.getContext('2d').");
    }
    this.ctx = ctx;
    this.roughCanvas = rough.canvas(canvas);
    // [CanvasEngine] Constructed
    this.canvasBgColor = canvasBgColor;
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.token = token;
    this.isStandalone = isStandalone;
    this.onScaleChangeCallback = onScaleChangeCallback;
    this.onParticipantsUpdate = onParticipantsUpdate;
    this.onConnectionChange = onConnectionChange;
    this.SelectionController = new SelectionController(this.ctx, canvas);
    // Phase 4: Share the spatial index so SelectionController uses O(log n) snapping
    this.SelectionController.spatialIndex = this.spatialIndex;

    this.encryptionKey = encryptionKey;

    this.clicked = false;
    // Initialize Yjs
    this.yDoc = new Y.Doc();
    this.yShapes = this.yDoc.getMap<Shape>("shapes");
    this.yOrder = this.yDoc.getArray<string>("shapeOrder");
    this.yGroups = this.yDoc.getMap<GroupDescriptor>("groups"); // Phase 3: group descriptors
    this.yUndoManager = new Y.UndoManager([this.yShapes, this.yOrder]);

    // Phase 5: CommandManager — local-origin only, multiplayer-safe
    this.commandManager = new CommandManager(
      this.yShapes, this.yOrder, this.yDoc,
      this.connectionId || "local"
    );
    this.commandManager.onChange = (canUndo, canRedo) => {
      this.onHistoryChange?.(canUndo, canRedo);
    };

    // Phase 6: LayerManager — Yjs-synced layer hierarchy
    this.layerManager = new LayerManager(this.yDoc, this.connectionId || "local");
    this.layerManager.onChange = (layers) => {
      this.clearCanvas();
    };

    // Observers for sync and undo/redo re-renders
    this.yShapes.observe(() => this.rebuildFromYjs());
    this.yOrder.observe(() => this.rebuildFromYjs());
    this.yGroups.observe(() => this.rebuildGroupDescriptors());
    this.yUndoManager.on("stack-item-added", () => {
      this.rebuildFromYjs();
    });
    this.yUndoManager.on("stack-item-popped", () => {
      this.rebuildFromYjs();
    });

    // Phase 6: Persistence hook - Listen to any CRDT update
    this.yDoc.on('update', () => {
      if (this.onDocumentChange) {
        this.onDocumentChange();
      }
    });

    const rect = this.canvas.getBoundingClientRect();
    const initialWidth = Math.max(1, Math.round(rect.width || document.body.clientWidth || window.innerWidth));
    const initialHeight = Math.max(1, Math.round(rect.height || document.body.clientHeight || window.innerHeight));
    this.canvas.width = initialWidth;
    this.canvas.height = initialHeight;

    this.currentTheme = appTheme;

    this.init();
    this.initMouseHandler();

    this.SelectionController.setOnLiveUpdate((shapes) => {
      shapes.forEach(shape => {
        this.updateConnectedLines(shape);
        this.streamShapeUpdate(shape);
      });
    });
    this.SelectionController.setOnDragOrResizeCursorMove((x, y) => {
      this.sendCursorMove(x, y);
    });
    if (!this.isStandalone && this.token && this.roomId) {
      this.connectWebSocket();
    }

    // Presence animation loop
    this.presenceLastTick = performance.now();
    this.presenceAnimFrameId = requestAnimationFrame(this.animatePresence);
  }

  public destroy() {
    this.isDestroyed = true;
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("wheel", this.mouseWheelHandler);
    this.canvas.removeEventListener("touchstart", this.touchStartHandler);
    this.canvas.removeEventListener("touchmove", this.touchMoveHandler);
    this.canvas.removeEventListener("touchend", this.touchEndHandler);
    window.removeEventListener("keydown", this.handleKeyDown);

    if (this.presenceAnimFrameId) cancelAnimationFrame(this.presenceAnimFrameId);
    if (this.laserAnimFrameId) cancelAnimationFrame(this.laserAnimFrameId);
    if (this.flushInterval) clearInterval(this.flushInterval);
    if (this.cursorThrottleTimeout) clearTimeout(this.cursorThrottleTimeout);
    if (this.streamingThrottleTimeout) clearTimeout(this.streamingThrottleTimeout);
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: WsDataType.LEAVE,
          roomId: this.roomId,
        }));
      }
      this.socket.close();
      this.socket = null;
    }
    this.yUndoManager.destroy();
    this.yDoc.destroy();
  }
  private animatePresence = (now: number) => {
    const dt = now - this.presenceLastTick;
    this.presenceLastTick = now;
    let needsRedraw = false;
    const lerpFactor = 0.15;

    this.remoteCursors.forEach((state, key) => {
      const dx = state.targetX - state.x;
      const dy = state.targetY - state.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        state.x += dx * lerpFactor;
        state.y += dy * lerpFactor;
        needsRedraw = true;
      }
      if (now - state.lastUpdate > 30000) {
        this.remoteCursors.delete(key);
        needsRedraw = true;
      }
    });

    if (needsRedraw) this.clearCanvas();
    this.presenceAnimFrameId = requestAnimationFrame(this.animatePresence);
  };

  private connectWebSocket() {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.CONNECTING ||
        this.socket.readyState === WebSocket.OPEN)
    ) {
      // console.log("Connection already exists, not creating a new one");
      return;
    }

    const url = `${WS_URL}?token=${encodeURIComponent(this.token!)}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.isConnected = true;
      this.onConnectionChange?.(true);
      this.socket?.send(
        JSON.stringify({
          type: WsDataType.JOIN,
          roomId: this.roomId,
          userId: this.userId,
          userName: this.userName,
        })
      );
    };

    this.socket.onmessage = async (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        if (data.type === WsDataType.CONNECTION_READY) {
          this.connectionId = data.connectionId;
          // console.log(`Assigned connection ID: ${this.connectionId}`);
        }

        switch (data.type) {
          case WsDataType.USER_JOINED:
            if (
              data.userId === this.userId &&
              data.connectionId !== this.connectionId
            ) {
              this.myConnections.push({
                connectionId: data.connectionId,
                connected: true,
              });
              // console.log(`🔁 Another tab detected: ${data.connectionId}`);
            }
            if (data.participants && Array.isArray(data.participants)) {
              this.participants = data.participants;
              this.onParticipantsUpdate?.(this.participants);
            }
            break;

          case WsDataType.USER_LEFT:
            if (data.userId === this.userId && data.connectionId) {
              this.myConnections = this.myConnections.filter(
                (c: { connectionId: string; connected: boolean }) => c.connectionId !== data.connectionId
              );
            }
            if (data.userId) {
              this.participants = this.participants.filter(
                (u) => u.userId !== data.userId
              );
              this.onParticipantsUpdate?.(this.participants);
            }
            break;

          case WsDataType.CURSOR_MOVE:
            if (data.userId !== this.userId && data.message) {
              const coords = JSON.parse(data.message);
              const key = `${data.userId}-${data.connectionId}`;
              const existing = this.remoteCursors.get(key);
              
              this.remoteCursors.set(key, {
                x: existing ? existing.x : coords.x,
                y: existing ? existing.y : coords.y,
                targetX: coords.x,
                targetY: coords.y,
                userId: data.userId,
                userName: data.userName ?? data.userId,
                color: getCollaboratorColor(data.userId),
                lastUpdate: performance.now(),
                isLaser: coords.isLaser,
                isEditing: coords.isEditing,
                selectionIds: coords.selectionIds,
                viewport: coords.viewport
              });

              if (this.followUserId === data.userId) {
                this.panX = coords.x - (this.canvas.width / 2) / this.scale;
                this.panY = coords.y - (this.canvas.height / 2) / this.scale;
                this.triggerViewChange();
              }
              
              if (coords.isLaser) {
                  const strokeFill = coords.strokeFill || "#ff0000";
                  let currentStroke = this.laserStrokes.find(s => s.connectionId === data.connectionId);
                  if (!currentStroke) {
                      currentStroke = { points: [], strokeFill, connectionId: data.connectionId };
                      this.laserStrokes.push(currentStroke);
                  }
                  currentStroke.points.push({ x: coords.x, y: coords.y, time: Date.now() });
                  if (!this.laserAnimFrameId) {
                      this.laserAnimFrameId = requestAnimationFrame(this.updateLaserAnimation);
                  }
              }

              this.clearCanvas();
              // Phase 5: fire React overlay callback for LiveCursors component
              this.onCursorUpdate?.(data.userId, data.userName ?? data.userId, coords.x, coords.y);
            }
            break;

          case WsDataType.EXISTING_SHAPES:
            if (Array.isArray(data.message) && data.message.length > 0) {
              const decryptedShapes = await Promise.all(
                data.message.map(async (shape) => {
                  if (shape.message) {
                    const decrypted = await decryptData(
                      shape.message,
                      this.encryptionKey!
                    );
                    return JSON.parse(decrypted);
                  }
                  return null;
                })
              );

              const validShapes = decryptedShapes.filter((s) => s !== null);
              if (validShapes.length > 0) {
                this.updateShapes(validShapes);
                this.notifyShapeCountChange();
              }
            }
            break;

          case WsDataType.STREAM_SHAPE:
            if (
              data.userId === this.userId &&
              data.connectionId !== this.connectionId &&
              data.message
            ) {
              try {
                const decrypted = await decryptData(
                  data.message,
                  this.encryptionKey!
                );
                const streamedShape = JSON.parse(decrypted);

                const streamKey = getStreamKey({
                  userId: data.userId,
                  connectionId: data.connectionId,
                  shapeId: streamedShape.id,
                });
                this.remoteStreamingShapes.set(streamKey, streamedShape);
                const userConnKey = `${data.userId}-${data.connectionId}`;
                this.remoteClickIndicators.set(userConnKey, Date.now());
                this.clearCanvas();
              } catch (err) {
                console.error("Error handling streamed shape:", err);
              }
            } else if (data.userId !== this.userId && data.message) {
              try {
                const decrypted = await decryptData(
                  data.message,
                  this.encryptionKey!
                );
                const streamedShape = JSON.parse(decrypted);

                const streamKey = getStreamKey({
                  userId: data.userId,
                  connectionId: data.connectionId,
                  shapeId: streamedShape.id,
                });
                this.remoteStreamingShapes.set(streamKey, streamedShape);
                const userConnKey = `${data.userId}-${data.connectionId}`;
                this.remoteClickIndicators.set(userConnKey, Date.now());
                this.clearCanvas();
              } catch (err) {
                console.error("Error handling streamed shape:", err);
              }
            }
            break;

          case WsDataType.STREAM_UPDATE:
            if (
              data.userId !== this.userId &&
              data.connectionId &&
              data.message
            ) {
              const decrypted = await decryptData(
                data.message,
                this.encryptionKey!
              );
              const streamedShape = JSON.parse(decrypted);
              const streamKey = getStreamKey({
                userId: data.userId,
                connectionId: data.connectionId,
                shapeId: streamedShape.id,
              });
              this.remoteStreamingShapes.set(streamKey, streamedShape);
              const userConnKey = `${data.userId}-${data.connectionId}`;
              this.remoteClickIndicators.set(userConnKey, Date.now());
              this.clearCanvas();
            }
            break;

          case WsDataType.DRAW:
          case WsDataType.UPDATE:
            if (
              data.userId === this.userId &&
              data.connectionId !== this.connectionId
            ) {
              if (data.message) {
                const decrypted = await decryptData(
                  data.message,
                  this.encryptionKey!
                );
                const shape = JSON.parse(decrypted);
                this.updateShapes([shape]);
                this.notifyShapeCountChange();
              }
            } else if (data.userId !== this.userId && data.message) {
              const decrypted = await decryptData(
                data.message,
                this.encryptionKey!
              );
              const shape = JSON.parse(decrypted);
              const streamKey = getStreamKey({
                userId: data.userId,
                connectionId: data.connectionId,
                shapeId: shape.id,
              });
              this.remoteStreamingShapes.delete(streamKey);
              this.updateShapes([shape]);
              this.notifyShapeCountChange();
            }
            break;

          case WsDataType.ERASER:
            if (
              data.userId === this.userId &&
              data.connectionId !== this.connectionId
            ) {
              if (data.id) {
                this.removeShape(data.id);
              }
            } else if (data.userId !== this.userId && data.id) {
              this.removeShape(data.id);
            }
            break;
        }
      } catch (err) {
        console.error("Error handling WS message:", err);
      }
    };

    this.socket.onclose = (e) => {
      this.isConnected = false;
      this.onConnectionChange?.(false);
      if (!this.isDestroyed) {
        setTimeout(() => this.connectWebSocket(), 2000);
      }
    };

    this.socket.onerror = (err) => {
      this.isConnected = false;
      this.onConnectionChange?.(false);
      console.error("WebSocket error:", err);
    };

    this.flushInterval = setInterval(() => {
      if (this.isConnected) {
        MessageQueue.flush((message) => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return true;
          }
          return false;
        });
      }
    }, 5000);
  }

  public async sendMessage(content: string) {
    if (!content?.trim()) return;
    const parsed = JSON.parse(content);

    if (this.socket?.readyState === WebSocket.OPEN) {
      const base = {
        roomId: parsed.roomId,
        userId: this.userId,
        userName: this.userName,
      };

      const encryptedMessage = await encryptData(
        JSON.stringify(parsed.message),
        this.encryptionKey!
      );

      const msg = {
        ...base,
        type: parsed.type,
        id: parsed.id,
        message: encryptedMessage,
      };
      this.socket.send(JSON.stringify(msg));
    } else {
      MessageQueue.enqueue({
        type: parsed.type,
        id: parsed.id,
        message: parsed.message ? JSON.stringify(parsed.message) : null,
        roomId: this.roomId!,
        userId: this.userId!,
        userName: this.userName!,
        timestamp: new Date().toISOString(),
        participants: null,
        connectionId: this.connectionId!,
      });
    }
  }

  private streamShape(shape: Shape) {
    if (!this.isConnected || this.isStandalone) return;

    if (!this.streamingShapeId) {
      this.streamingShapeId = shape.id;
    }

    if (this.streamingThrottleTimeout !== null) {
      return;
    }

    this.streamingThrottleTimeout = window.setTimeout(() => {
      if (this.socket?.readyState === WebSocket.OPEN && this.roomId) {
        const message = {
          type: WsDataType.STREAM_SHAPE,
          id: shape.id,
          message: shape,
          roomId: this.roomId,
          userId: this.userId!,
          userName: this.userName!,
          timestamp: new Date().toISOString(),
          connectionId: this.connectionId,
        };

        this.sendMessage?.(JSON.stringify(message)).catch((e) => {
          console.error("Error streaming shape update", e);
        });
      }
      this.streamingThrottleTimeout = null;
    }, this.streamingUpdateInterval);
  }

  private streamShapeUpdate(shape: Shape) {
    if (!this.isConnected || this.isStandalone) return;
    if (this.streamingThrottleTimeout !== null) return;

    this.streamingThrottleTimeout = window.setTimeout(() => {
      if (this.socket?.readyState === WebSocket.OPEN && this.roomId) {
        const message = {
          type: WsDataType.STREAM_UPDATE,
          id: shape.id,
          message: shape,
          roomId: this.roomId,
          userId: this.userId!,
          userName: this.userName!,
          timestamp: new Date().toISOString(),
          connectionId: this.connectionId,
        };

        this.sendMessage?.(JSON.stringify(message)).catch((e) => {
          console.error("Error streaming shape update", e);
        });
      }
      this.streamingThrottleTimeout = null;
    }, this.streamingUpdateInterval);
  }

  private sendCursorMove(x: number, y: number) {
    if (!this.isStandalone && this.isConnected) {
      const message = {
        type: WsDataType.CURSOR_MOVE,
        roomId: this.roomId,
        userId: this.userId!,
        userName: this.userName!,
        connectionId: this.connectionId,
        message: JSON.stringify({ x, y }),
      };

      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      }
    }
  }

  async init() {
    window.addEventListener("keydown", this.handleKeyDown);
    console.debug("[CanvasEngine] init: canvas size", this.canvas.width, this.canvas.height);
    try {
      this.clearCanvas();
    } catch (e) {
      console.error("[CanvasEngine] error during initial clearCanvas:", e);
    }
  }

  initMouseHandler() {
    // [CanvasEngine] initMouseHandler - attaching listeners
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("wheel", this.mouseWheelHandler, {
      passive: false,
    });
    this.canvas.addEventListener("touchstart", this.touchStartHandler, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.touchMoveHandler, {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.touchEndHandler, {
      passive: false,
    });
  }

  setTool(tool: ToolType) {
    this.activeTool = tool;
    if (tool !== "selection" && this.SelectionController.hasSelection()) {
      this.SelectionController.setSelectedShapes([]);
      this.clearCanvas();
    }
  }

  setStrokeWidth(width: StrokeWidth) {
    this.strokeWidth = width;
    this.clearCanvas();
  }

  setStrokeFill(fill: string) {
    this.strokeFill = fill;
    this.clearCanvas();
  }

  setBgFill(fill: string) {
    this.bgFill = fill;
    this.clearCanvas();
  }

  setCanvasBgColor(color: string) {
    if (this.canvasBgColor !== color) {
      this.canvasBgColor = color;
      this.clearCanvas();
    }
  }

  setStrokeEdge(edge: StrokeEdge) {
    this.strokeEdge = edge;
    this.clearCanvas();
  }

  setStrokeStyle(style: StrokeStyle) {
    this.strokeStyle = style;
    this.clearCanvas();
  }

  setRoughStyle(rough: RoughStyle) {
    this.roughStyle = rough;
    this.clearCanvas();
  }

  setFillStyle(fill: FillStyle) {
    this.fillStyle = fill;
    this.clearCanvas();
  }

  setFontFamily(fontFamily: FontFamily) {
    this.fontFamily = fontFamily;
    this.clearCanvas();
  }

  setFontSize(size: FontSize) {
    this.fontSize = size;
    this.clearCanvas();
  }

  setTextAlign(align: TextAlign) {
    this.textAlign = align;
    this.clearCanvas();
  }

  setFontStyle(style: FontStyle) {
    this.fontStyle = style;
    this.clearCanvas();
  }

  private getRoughOptions(
    strokeWidth: number,
    strokeFill: string,
    roughStyle: RoughStyle,
    bgFill?: string,
    strokeStyle?: StrokeStyle,
    fillStyle?: FillStyle,
    hachureAngle: number = 60,
    shapeType?: Shape["type"]
  ): Options {
    const isCurveSensitive =
      shapeType === "ellipse" || shapeType === "free-draw";

    const options: Options = {
      stroke: strokeFill,
      strokeWidth: strokeStyle !== "solid" ? strokeWidth + 0.6 : strokeWidth,
      roughness: roughStyle,
      bowing: roughStyle === 0 ? 0 : 0.5 * roughStyle,
      fill: bgFill ?? "",
      fillStyle: fillStyle,
      hachureAngle: hachureAngle,
      hachureGap: strokeWidth * 4,
      seed: this.roughSeed,
      disableMultiStroke: true,
      disableMultiStrokeFill: true,
      fillWeight: strokeWidth,
      strokeLineDash:
        strokeStyle === "dashed"
          ? getDashArrayDashed(strokeWidth)
          : strokeStyle === "dotted"
            ? getDashArrayDotted(strokeWidth)
            : undefined,
      dashOffset:
        strokeStyle === "dashed" ? 5 : strokeStyle === "dotted" ? 2 : undefined,
      ...(isCurveSensitive
        ? {}
        : {
          curveFitting: 1,
          curveTightness: 1,
          preserveVertices: true,
        }),

      // Ensure the sketchy path closely follows the original shape with minimal deviation
      // curveFitting: 1,

      // Tightens the curves around corner control points for smoother rounded corners
      // curveTightness: 1,

      // Prevents Rough.js from altering the actual vertex points — keeps the shape precise
      // preserveVertices: true,
    };

    return options;
  }

  clearCanvas() {
<<<<<<< HEAD
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.panX, this.panY);
    this.ctx.clearRect(-this.panX / this.scale, -this.panY / this.scale, this.canvas.width / this.scale, this.canvas.height / this.scale);
    this.ctx.fillStyle = this.canvasBgColor;
    this.ctx.fillRect(-this.panX / this.scale, -this.panY / this.scale, this.canvas.width / this.scale, this.canvas.height / this.scale);

    if (this.snapEngine.config.gridEnabled) {
      this.snapEngine.drawGrid(this.ctx, this.panX, this.panY, this.scale, this.canvas.width, this.canvas.height, this.currentTheme === "dark");
    }

    const viewportBounds = {
      minX: -this.panX / this.scale,
      minY: -this.panY / this.scale,
      maxX: (-this.panX + this.canvas.width) / this.scale,
      maxY: (-this.panY + this.canvas.height) / this.scale,
    };

    const shapesToRender = this.spatialIndex.getVisibleShapes(viewportBounds);
    const layerSorted = this.layerManager.filterAndSort(shapesToRender);

    layerSorted.forEach((shape: Shape) => {
      const isBeingStreamed = [...this.remoteStreamingShapes.values()].some(s => s.id === shape.id);
      if (isBeingStreamed) return;

      // Hover Affordance
      if (this.hoveredShapeId === shape.id && this.activeTool === "selection" && !this.SelectionController.getSelectedShapes().find(s => s.id === shape.id)) {
        this.ctx.save();
        TransformEngine.applyTransform(this.ctx, shape);
        const bounds = this.SelectionController.getShapeBounds(shape);
        this.ctx.strokeStyle = "rgba(105, 101, 219, 0.4)";
        this.ctx.lineWidth = 1.5 / this.scale;
        this.ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
        this.ctx.restore();
      }
      
      this.ctx.save();
      TransformEngine.applyTransform(this.ctx, shape);
      this.renderSingleShape(shape);
      this.ctx.restore();
    });

    this.remoteStreamingShapes.forEach((shape) => {
      this.ctx.save();
      TransformEngine.applyTransform(this.ctx, shape);
      this.renderSingleShape(shape);
      this.ctx.restore();
    });
=======
    try {
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.panX, this.panY);
      this.ctx.clearRect(-this.panX / this.scale, -this.panY / this.scale, this.canvas.width / this.scale, this.canvas.height / this.scale);
      this.ctx.fillStyle = this.canvasBgColor;
      this.ctx.fillRect(-this.panX / this.scale, -this.panY / this.scale, this.canvas.width / this.scale, this.canvas.height / this.scale);

      if (this.snapEngine.config.gridEnabled) {
        this.snapEngine.drawGrid(this.ctx, this.panX, this.panY, this.scale, this.canvas.width, this.canvas.height, this.currentTheme === "dark");
      }

      const viewportBounds = {
        minX: -this.panX / this.scale,
        minY: -this.panY / this.scale,
        maxX: (-this.panX + this.canvas.width) / this.scale,
        maxY: (-this.panY + this.canvas.height) / this.scale,
      };

      const shapesToRender = this.spatialIndex.getVisibleShapes(viewportBounds);
      if (!Array.isArray(shapesToRender)) {
        console.warn("[CanvasEngine] unexpected shapesToRender type:", typeof shapesToRender, shapesToRender);
      }
      const layerSorted = this.layerManager.filterAndSort(shapesToRender);
      layerSorted.forEach((shape: Shape) => {
        try {
          const isBeingStreamed = [...this.remoteStreamingShapes.values()].some(s => s.id === shape.id);
          if (isBeingStreamed) return;

          // Hover Affordance
          if (this.hoveredShapeId === shape.id && this.activeTool === "selection" && !this.SelectionController.getSelectedShapes().find(s => s.id === shape.id)) {
            this.ctx.save();
            TransformEngine.applyTransform(this.ctx, shape);
            const bounds = this.SelectionController.getShapeBounds(shape);
            this.ctx.strokeStyle = "rgba(105, 101, 219, 0.4)";
            this.ctx.lineWidth = 1.5 / this.scale;
            this.ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
            this.ctx.restore();
          }

          this.ctx.save();
          TransformEngine.applyTransform(this.ctx, shape);
          this.renderSingleShape(shape);
          this.ctx.restore();
        } catch (e) {
          console.error("[CanvasEngine] error rendering shape", shape?.id, shape, e);
        }
      });

      this.remoteStreamingShapes.forEach((shape) => {
        this.ctx.save();
        TransformEngine.applyTransform(this.ctx, shape);
        this.renderSingleShape(shape);
        this.ctx.restore();
      });

      if (this.activeTextarea && this.activeTextPosition) {
        const { x, y } = this.activeTextPosition;
        this.activeTextarea.style.transform = `translate(${x * this.scale + this.panX}px, ${y * this.scale + this.panY}px)`;
      }

      if (this.activeTool === "selection" && this.isMarqueeSelecting) {
        this.drawMarquee();
      }
>>>>>>> f593772 (fix: resolve all TS errors, canvas white-screen, and React Strict Mode bugs)

      if (this.activeTool === "lasso" && this.isLassoSelecting && this.lassoPoints.length > 1) {
        this.drawLasso();
      }

      if (this.laserStrokes.length > 0) {
        this.drawLaserStrokes();
      }

      if (this.SelectionController.hasSelection() && this.activeTool === "selection") {
        this.SelectionController.drawSelectionBox();
      }

      if (this.SelectionController.activeSnapLines?.length > 0) {
        this.drawSnapLines(viewportBounds);
      }

      // Multiplayer Presence
      try {
        this.renderPresence(viewportBounds);
      } catch (e) {
        console.error("Error rendering presence:", e);
      }
    } catch (err) {
      console.error("Critical error in render loop:", err);
    }
  }

<<<<<<< HEAD
    if (this.activeTool === "selection" && this.isMarqueeSelecting) {
      this.drawMarquee();
    }

    if (this.activeTool === "lasso" && this.isLassoSelecting && this.lassoPoints.length > 1) {
      this.drawLasso();
    }

    if (this.laserStrokes.length > 0) {
      this.drawLaserStrokes();
    }

    if (this.SelectionController.hasSelection() && this.activeTool === "selection") {
      this.SelectionController.drawSelectionBox();
    }

    if (this.SelectionController.activeSnapLines?.length > 0) {
      this.drawSnapLines(viewportBounds);
    }

    // Multiplayer Presence
    this.renderPresence(viewportBounds);

    this.ctx.restore();
  }

=======
>>>>>>> f593772 (fix: resolve all TS errors, canvas white-screen, and React Strict Mode bugs)
  private renderSingleShape(shape: Shape) {
    if (shape.type === "rectangle") {
      this.drawRect(shape.x, shape.y, shape.width, shape.height, shape.strokeWidth || DEFAULT_STROKE_WIDTH, shape.strokeFill || DEFAULT_STROKE_FILL, shape.bgFill || DEFAULT_BG_FILL, shape.rounded, shape.strokeStyle, shape.roughStyle, shape.fillStyle);
    } else if (shape.type === "ellipse") {
      this.drawEllipse(shape.x, shape.y, shape.radX, shape.radY, shape.strokeWidth || DEFAULT_STROKE_WIDTH, shape.strokeFill || DEFAULT_STROKE_FILL, shape.bgFill || DEFAULT_BG_FILL, shape.strokeStyle, shape.roughStyle, shape.fillStyle);
    } else if (shape.type === "diamond") {
      this.drawDiamond(shape.x, shape.y, shape.width, shape.height, shape.strokeWidth || DEFAULT_STROKE_WIDTH, shape.strokeFill || DEFAULT_STROKE_FILL, shape.bgFill || DEFAULT_BG_FILL, shape.rounded, shape.strokeStyle, shape.roughStyle, shape.fillStyle);
    } else if (shape.type === "line" || shape.type === "arrow") {
      this.drawLine(shape.x, shape.y, shape.toX, shape.toY, shape.strokeWidth || DEFAULT_STROKE_WIDTH, shape.strokeFill || DEFAULT_STROKE_FILL, shape.strokeStyle, shape.roughStyle, shape.type === "arrow");
    } else if (shape.type === "free-draw") {
      this.drawFreeDraw(shape.points, shape.strokeFill, shape.bgFill, shape.strokeStyle, shape.fillStyle, shape.strokeWidth);
    } else if (shape.type === "text") {
      this.drawText(shape.x, shape.y, shape.width, shape.height, shape.text, shape.strokeFill, shape.fontStyle, shape.fontFamily, shape.fontSize, shape.textAlign);
    } else if (shape.type === "sticky") {
      this.drawRect(shape.x, shape.y, shape.width, shape.height, 2, shape.strokeFill, shape.bgFill, shape.rounded, shape.strokeStyle, shape.roughStyle, "solid");
      this.drawText(shape.x, shape.y, shape.width, shape.height, shape.text, shape.strokeFill, shape.fontStyle, shape.fontFamily, shape.fontSize, shape.textAlign);
    } else if (shape.type === "image") {
      this.drawImageShape(shape);
    } else if (shape.type === "frame") {
      this.drawFrame(shape);
    } else if (shape.type === "embed") {
      this.drawEmbed(shape);
    }
  }

  private renderPresence(v: any) {
    this.remoteCursors.forEach((state) => {
      const color = state.color;
      // Viewports
      if (state.viewport) {
        this.ctx.save();
        this.ctx.setLineDash([10 / this.scale, 10 / this.scale]);
        this.ctx.strokeStyle = color + "44";
        this.ctx.lineWidth = 1 / this.scale;
        this.ctx.strokeRect(state.viewport.x, state.viewport.y, state.viewport.w, state.viewport.h);
        this.ctx.fillStyle = color + "88";
        this.ctx.font = `${10 / this.scale}px Inter, sans-serif`;
        this.ctx.fillText(state.userName, state.viewport.x + 5 / this.scale, state.viewport.y + 15 / this.scale);
        this.ctx.restore();
      }
      // Selections
      if (state.selectionIds?.length) {
<<<<<<< HEAD
        state.selectionIds.forEach(id => {
          const shape = this.existingShapes.find(s => s.id === id);
=======
        state.selectionIds.forEach((id: string) => {
          const shape = this.existingShapes.find((s: Shape) => s.id === id);
>>>>>>> f593772 (fix: resolve all TS errors, canvas white-screen, and React Strict Mode bugs)
          if (shape) {
            this.ctx.save();
            TransformEngine.applyTransform(this.ctx, shape);
            const bounds = this.SelectionController.getShapeBounds(shape);
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1 / this.scale;
            this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
            this.ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
            this.ctx.restore();
          }
        });
      }
      // Cursor (Screen Space)
      const screenX = state.x * this.scale + this.panX;
      const screenY = state.y * this.scale + this.panY;
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.shadowBlur = 4;
      this.ctx.shadowColor = "rgba(0,0,0,0.2)";
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.moveTo(screenX, screenY);
      this.ctx.lineTo(screenX + 2, screenY + 18);
      this.ctx.lineTo(screenX + 7, screenY + 13);
      this.ctx.lineTo(screenX + 14, screenY + 20);
      this.ctx.lineTo(screenX + 17, screenY + 17);
      this.ctx.lineTo(screenX + 10, screenY + 10);
      this.ctx.lineTo(screenX + 16, screenY + 4);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = "white";
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.font = "600 11px Inter, system-ui, sans-serif";
      const tagWidth = this.ctx.measureText(state.userName).width + 12;
<<<<<<< HEAD
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      roundRect(this.ctx, screenX + 10, screenY + 20, tagWidth, 20, 4);
      this.ctx.fill();
        this.ctx.fillStyle = "white";
        this.ctx.fillText(state.userName, screenX + 16, screenY + 34);

        if (state.isEditing) {
            this.ctx.font = "italic 9px Inter, sans-serif";
            this.ctx.fillStyle = "rgba(255,255,255,0.7)";
            this.ctx.fillText("Editing...", screenX + 16, screenY + 44);
        }
        
        this.ctx.restore();
=======
      // Draw the colored badge background first
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      roundRect(this.ctx, screenX + 10, screenY + 20, tagWidth, 20, 4);
      this.ctx.fill();          // ← was missing: actually paint the badge
      // Then draw the white name text on top
      this.ctx.fillStyle = "white";
      this.ctx.fillText(state.userName, screenX + 16, screenY + 34);

      if (state.isEditing) {
        this.ctx.font = "italic 9px Inter, sans-serif";
        this.ctx.fillStyle = "rgba(255,255,255,0.7)";
        this.ctx.fillText("Editing...", screenX + 16, screenY + 44);
      }
      this.ctx.restore();
>>>>>>> f593772 (fix: resolve all TS errors, canvas white-screen, and React Strict Mode bugs)
    });
  }

  private drawMarquee() {
    const minX = Math.min(this.marqueeStartX, this.marqueeCurrentX);
    const minY = Math.min(this.marqueeStartY, this.marqueeCurrentY);
    const width = Math.abs(this.marqueeCurrentX - this.marqueeStartX);
    const height = Math.abs(this.marqueeCurrentY - this.marqueeStartY);
    this.ctx.save();
    this.ctx.fillStyle = "rgba(105, 101, 219, 0.08)";
    this.ctx.strokeStyle = "#6965db";
    this.ctx.lineWidth = 1 / this.scale;
    this.ctx.strokeRect(minX, minY, width, height);
    this.ctx.fillRect(minX, minY, width, height);
    this.ctx.restore();
  }

  private drawLasso() {
    this.ctx.save();
    this.ctx.fillStyle = "rgba(105, 101, 219, 0.08)";
    this.ctx.strokeStyle = "#6965db";
    this.ctx.lineWidth = 1 / this.scale;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
    this.lassoPoints.forEach(p => this.ctx.lineTo(p.x, p.y));
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawLaserStrokes() {
    const now = Date.now();
    this.ctx.save();
    this.laserStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      this.ctx.strokeStyle = stroke.strokeFill;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];
        const age = now - p1.time;
        const opacity = Math.max(0, 1 - (age / 1500));
        this.ctx.globalAlpha = opacity;
        this.ctx.lineWidth = 6 * opacity / this.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
      }
    });
    this.ctx.restore();
  }

  private drawSnapLines(v: any) {
    this.ctx.save();
    this.ctx.strokeStyle = "#e83e8c";
    this.ctx.lineWidth = 1 / this.scale;
    this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
    this.ctx.beginPath();
    this.SelectionController.activeSnapLines.forEach(line => {
      if (line.x !== undefined) { this.ctx.moveTo(line.x, v.minY); this.ctx.lineTo(line.x, v.maxY); }
      if (line.y !== undefined) { this.ctx.moveTo(v.minX, line.y); this.ctx.lineTo(v.maxX, line.y); }
    });
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawFrame(shape: any) {
    this.ctx.save();
    this.ctx.strokeStyle = "#a5a5a5";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 3]);
    this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = "#a5a5a5";
    this.ctx.font = "bold 13px sans-serif";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText(shape.frameName, shape.x, shape.y - 6);
    this.ctx.restore();
  }

  private drawEmbed(shape: any) {
    this.ctx.save();
    this.ctx.fillStyle = "#f1f3f5";
    this.ctx.strokeStyle = "#ced4da";
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    this.ctx.fillStyle = "#868e96";
    this.ctx.font = "14px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(shape.url, shape.x + shape.width / 2, shape.y + shape.height / 2);
    this.ctx.restore();
  }

<<<<<<< HEAD
  }
  }
=======

>>>>>>> f593772 (fix: resolve all TS errors, canvas white-screen, and React Strict Mode bugs)

  public getShapeCenter(shape: Shape): { x: number; y: number } {
  const bounds = this.SelectionController.getShapeBounds(shape);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

  private getShapeAtPoint(x: number, y: number): Shape | undefined {
  for (let i = this.existingShapes.length - 1; i >= 0; i--) {
    const shape = this.existingShapes[i];
    if (this.isPointInShape(x, y, shape)) {
      return shape;
    }
  }
  return undefined;
}

  public updateConnectedLines(movedShape: Shape) {
  if (!movedShape.id) return;
  this.existingShapes.forEach((s) => {
    if (s.type === "line" || s.type === "arrow") {
      if (s.startShapeId === movedShape.id) {
        const center = this.getShapeCenter(movedShape);
        s.x = center.x;
        s.y = center.y;
      }
      if (s.endShapeId === movedShape.id) {
        const center = this.getShapeCenter(movedShape);
        s.toX = center.x;
        s.toY = center.y;
      }
    }
  });
}

  private updateLaserAnimation = () => {
    const now = Date.now();
    let needsUpdate = false;

    this.laserStrokes.forEach(stroke => {
      const originalLength = stroke.points.length;
      stroke.points = stroke.points.filter(p => now - p.time < 1500); // 1.5s decay
      if (stroke.points.length !== originalLength) {
        needsUpdate = true;
      }
    });

    const originalStrokesCount = this.laserStrokes.length;
    this.laserStrokes = this.laserStrokes.filter(s => s.points.length > 0);
    if (this.laserStrokes.length !== originalStrokesCount) {
      needsUpdate = true;
    }

    if (needsUpdate || this.laserStrokes.length > 0) {
      this.clearCanvas();
      this.laserAnimFrameId = requestAnimationFrame(this.updateLaserAnimation);
    } else {
      this.laserAnimFrameId = null;
      this.clearCanvas();
    }
  }

mouseDownHandler = (e: MouseEvent) => {
  if (this.isReadOnly) {
      this.activeTool = "grab";
      this.isDraggingCanvas = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return;
  }

  const { x, y } = this.transformPanScale(e.clientX, e.clientY);
  // [CanvasEngine] mouseDown: clientX=%d clientY=%d tool=%s
  if (this.activeTool === "selection") {
    if (this.SelectionController.hasSelection()) {
      const handle = this.SelectionController.getResizeHandleAtPoint(x, y);

      if (handle) {
        this.saveState();
        this.SelectionController.startResizing(x, y);
        return;
      }
      
      if (this.SelectionController.isPointInCombinedBounds(x, y)) {
          this.saveState();
          this.SelectionController.startDragging(x, y);
          return;
      }
    }

    let found = false;
    for (let i = this.existingShapes.length - 1; i >= 0; i--) {
      const shape = this.existingShapes[i];

      // Phase 6: Skip shapes on locked layers
      if (this.layerManager.isShapeLocked(shape)) continue;

      if (this.SelectionController.isPointInShape(x, y, shape)) {
        found = true;
        // Phase 3: resolve to group root via GroupManager
        const resolved = this.groupManager.resolveSelection(shape, this.existingShapes);
        
        if (e.shiftKey) {
            const isSelected = this.SelectionController.getSelectedShapes().find(s => s.id === shape.id);
            if (isSelected) {
                const newSelection = this.SelectionController.getSelectedShapes().filter(s => !resolved.find(g => g.id === s.id));
                this.SelectionController.setSelectedShapes(newSelection);
            } else {
                this.SelectionController.setSelectedShapes([...this.SelectionController.getSelectedShapes(), ...resolved]);
            }
        } else if (!this.SelectionController.getSelectedShapes().find(s => s.id === shape.id)) {
            this.SelectionController.setSelectedShapes(resolved);
        }
        
        this.saveState();
        this.SelectionController.startDragging(x, y);
        this.clearCanvas();
        return;
      }
    }
    
    if (!found) {
        if (!e.shiftKey) {
            this.SelectionController.setSelectedShapes([]);
        }
        
        this.isMarqueeSelecting = true;
        this.marqueeStartX = x;
        this.marqueeStartY = y;
        this.marqueeCurrentX = x;
        this.marqueeCurrentY = y;
        
        this.clearCanvas();
        return;
    }
  }

  if (this.activeTool === "grab") {
    this.isDraggingCanvas = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    return;
  }

  this.clicked = true;
  this.startX = this.isSnapToGrid ? Math.round(x / 20) * 20 : x;
  this.startY = this.isSnapToGrid ? Math.round(y / 20) * 20 : y;

  if (this.activeTool === "free-draw") {
    this._addShapeToCRDT({
      id: uuidv4(),
      type: "free-draw",
      points: [{ x, y }],
      strokeWidth: this.strokeWidth,
      strokeFill: this.strokeFill,
      bgFill: this.bgFill,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
    });
  } else if (this.activeTool === "text") {
    this.clicked = false;
    this.handleTexty(e);
  } else if (this.activeTool === "sticky") {
    this.clicked = false;
    this.handleSticky(e);
  } else if (this.activeTool === "image") {
    this.clicked = false;
    this.handleImageUpload(x, y);
  } else if (this.activeTool === "comment") {
    this.clicked = false;
    this.updateShapes([{
        id: uuidv4(),
        type: "comment",
        x,
        y,
        text: "",
        userId: this.userId || "guest",
        userName: this.userName || "Guest",
        replies: []
    }]);
    this.activeTool = "selection";
  } else if (this.activeTool === "github_card" || this.activeTool === "jira_card") {
    this.clicked = false;
    const url = prompt(`Enter ${this.activeTool === "github_card" ? "GitHub" : "Jira"} Issue URL:`);
    if (url) {
      this.handleCardUpload(x, y, url, this.activeTool);
    }
    this.activeTool = "selection";
  } else if (this.activeTool === "eraser") {
    this.eraser(x, y);
  } else if (this.activeTool === "laser") {
    this.clicked = true;
    this.laserStrokes.push({ points: [{ x, y, time: Date.now() }], strokeFill: this.strokeFill });
    if (!this.laserAnimFrameId) {
      this.laserAnimFrameId = requestAnimationFrame(this.updateLaserAnimation);
    }
  } else if (this.activeTool === "lasso") {
    this.isLassoSelecting = true;
    this.lassoPoints = [{ x, y }];
    this.SelectionController.setSelectedShapes([]);
  }
  this.clearCanvas();
};

mouseUpHandler = (e: MouseEvent) => {
  if (
    this.activeTool !== "free-draw" &&
    this.activeTool !== "eraser" &&
    this.activeTool !== "line" &&
    this.activeTool !== "arrow" &&
    this.activeTool !== "laser" &&
    this.activeTool !== "lasso"
  ) {
    if (this.activeTool === "selection") {
      if (this.isMarqueeSelecting) {
          this.isMarqueeSelecting = false;
          
          const minX = Math.min(this.marqueeStartX, this.marqueeCurrentX);
          const minY = Math.min(this.marqueeStartY, this.marqueeCurrentY);
          const width = Math.abs(this.marqueeCurrentX - this.marqueeStartX);
          const height = Math.abs(this.marqueeCurrentY - this.marqueeStartY);
          
          // only select if marquee was actually dragged a tiny bit
          if (width > 5 || height > 5) {
              const marqueeBounds = { x: minX, y: minY, width, height };
              const shapesInMarquee = this.SelectionController.getShapesInMarquee(marqueeBounds, this.existingShapes);
              if (shapesInMarquee.length > 0) {
                  const groupIds = new Set<string>();
                  shapesInMarquee.forEach(s => {
                      if (s.groupId) groupIds.add(s.groupId);
                  });
                  
                  const finalSelection = new Set<Shape>(shapesInMarquee);
                  if (groupIds.size > 0) {
                      this.existingShapes.forEach(s => {
                          if (s.groupId && groupIds.has(s.groupId)) {
                              finalSelection.add(s);
                          }
                      });
                  }
                  
                  this.SelectionController.setSelectedShapes(Array.from(finalSelection));
              }
          }
          this.clearCanvas();
          return;
      }

      if (
        this.SelectionController.isDraggingShape() ||
        this.SelectionController.isResizingShape()
      ) {
        const selectedShapes = this.SelectionController.getSelectedShapes();
        if (selectedShapes.length > 0) {
          this.saveState();
          
          selectedShapes.forEach(selectedShape => {
              const index = this.existingShapes.findIndex(
                (shape) => shape.id === selectedShape.id
              );
              if (index !== -1) {
                this._updateShapeInCRDT(selectedShape);
                if (this.sendMessage && this.roomId) {
                  try {
                    this.sendMessage?.(
                      JSON.stringify({
                        type: WsDataType.UPDATE,
                        id: selectedShape.id,
                        message: selectedShape,
                        roomId: this.roomId,
                      })
                    );
                  } catch (e) {
                    MessageQueue.enqueue({
                      type: WsDataType.UPDATE,
                      id: selectedShape.id,
                      message: JSON.stringify(selectedShape),
                      roomId: this.roomId,
                      userId: this.userId!,
                      userName: this.userName!,
                      timestamp: new Date().toISOString(),
                      participants: null,
                      connectionId: this.connectionId!,
                    });
                    console.error("Error sending shape update ws message", e);
                  }
                }
    
                this.existingShapes.forEach((s) => {
                  if ((s.type === "line" || s.type === "arrow") && (s.startShapeId === selectedShape.id || s.endShapeId === selectedShape.id)) {
                    if (this.sendMessage && this.roomId) {
                      try {
                        this.sendMessage(JSON.stringify({ type: WsDataType.UPDATE, id: s.id, message: s, roomId: this.roomId }));
                      } catch (e) {
                        console.error("Error syncing connected line", e);
                      }
                    }
                  }
                });
              }
          });
        }
        this.SelectionController.stopDragging();
        this.SelectionController.stopResizing();
        return;
      }
    }
  }
  
  if (this.activeTool === "lasso" && this.isLassoSelecting) {
    this.isLassoSelecting = false;
    if (this.lassoPoints.length > 2) {
      const shapesInLasso = this.SelectionController.getShapesInLasso(this.lassoPoints, this.existingShapes);
      if (shapesInLasso.length > 0) {
          const groupIds = new Set<string>();
          shapesInLasso.forEach(s => {
              if (s.groupId) groupIds.add(s.groupId);
          });
          
          const finalSelection = new Set<Shape>(shapesInLasso);
          if (groupIds.size > 0) {
              this.existingShapes.forEach(s => {
                  if (s.groupId && groupIds.has(s.groupId)) {
                      finalSelection.add(s);
                  }
              });
          }
          
          this.SelectionController.setSelectedShapes(Array.from(finalSelection));
          if (this.onToolChangeCallback) {
              this.onToolChangeCallback("selection");
          }
      }
    }
    this.lassoPoints = [];
    this.clearCanvas();
  }

  this.clicked = false;


  const { x, y } = this.transformPanScale(e.clientX, e.clientY);

  const snappedX = this.isSnapToGrid ? Math.round(x / 20) * 20 : x;
  const snappedY = this.isSnapToGrid ? Math.round(y / 20) * 20 : y;

  const width = snappedX - this.startX;
  const height = snappedY - this.startY;

  const isClick = Math.abs(width) > 5 || Math.abs(height) > 5;
  // [CanvasEngine] mouseUp: clientX=%d clientY=%d tool=%s

  if (isClick) {
    let shape: Shape | null = null;
    switch (this.activeTool) {
      case "rectangle":
        shape = {
          id: this.streamingShapeId || uuidv4(),
          type: "rectangle",
          x: this.startX,
          y: this.startY,
          width,
          height,
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          bgFill: this.bgFill,
          rounded: this.strokeEdge,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
          fillStyle: this.fillStyle,
        };
        break;

      case "frame":
        shape = {
          id: this.streamingShapeId || uuidv4(),
          type: "frame",
          x: width < 0 ? this.startX + width : this.startX,
          y: height < 0 ? this.startY + height : this.startY,
          width: Math.abs(width),
          height: Math.abs(height),
          frameName: `Frame ${this.existingShapes.filter(s => s.type === 'frame').length + 1}`
        };
        break;

      case "embed": {
        const url = prompt("Enter URL to embed:") || "https://example.com";
        shape = {
          id: this.streamingShapeId || uuidv4(),
          type: "embed",
          x: width < 0 ? this.startX + width : this.startX,
          y: height < 0 ? this.startY + height : this.startY,
          width: Math.abs(width),
          height: Math.abs(height),
          url
        };
        break;
      }

      case "ellipse":
        shape = {
          id: this.streamingShapeId || uuidv4(),
          type: "ellipse",
          x: this.startX + width / 2,
          y: this.startY + height / 2,
          radX: Math.abs(width / 2),
          radY: Math.abs(height / 2),
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          bgFill: this.bgFill,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
          fillStyle: this.fillStyle,
        };
        break;

      case "diamond":
        shape = {
          id: this.streamingShapeId || uuidv4(),
          type: "diamond",
          x: this.startX,
          y: this.startY,
          width: Math.abs(x - this.startX) * 2,
          height: Math.abs(y - this.startY) * 2,
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          bgFill: this.bgFill,
          rounded: this.strokeEdge,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
          fillStyle: this.fillStyle,
        };
        break;

      case "line": {
        const startShapeL = this.getShapeAtPoint(this.startX, this.startY);
        const endShapeL = this.getShapeAtPoint(x, y);
        const startCenterL = startShapeL ? this.getShapeCenter(startShapeL) : null;
        const endCenterL = endShapeL ? this.getShapeCenter(endShapeL) : null;

        shape = {
          id: this.streamingShapeId || uuidv4(),
          type: "line",
          x: startCenterL ? startCenterL.x : this.startX,
          y: startCenterL ? startCenterL.y : this.startY,
          toX: endCenterL ? endCenterL.x : x,
          toY: endCenterL ? endCenterL.y : y,
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
          startShapeId: startShapeL?.id || undefined,
          endShapeId: endShapeL?.id || undefined,
        };
        break;
      }

      case "arrow": {
        const startShapeA = this.getShapeAtPoint(this.startX, this.startY);
        const endShapeA = this.getShapeAtPoint(x, y);
        const startCenterA = startShapeA ? this.getShapeCenter(startShapeA) : null;
        const endCenterA = endShapeA ? this.getShapeCenter(endShapeA) : null;

        shape = {
          id: this.streamingShapeId || uuidv4(),
          type: "arrow",
          x: startCenterA ? startCenterA.x : this.startX,
          y: startCenterA ? startCenterA.y : this.startY,
          toX: endCenterA ? endCenterA.x : x,
          toY: endCenterA ? endCenterA.y : y,
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
          startShapeId: startShapeA?.id || undefined,
          endShapeId: endShapeA?.id || undefined,
        };
        break;
      }

      case "free-draw":
        const currentShape =
          this.existingShapes[this.existingShapes.length - 1];
        if (currentShape?.type === "free-draw") {
          shape = {
            id: this.streamingShapeId || uuidv4(),
            type: "free-draw",
            points: currentShape.points,
            strokeWidth: this.strokeWidth,
            strokeFill: this.strokeFill,
            bgFill: this.bgFill,
            strokeStyle: this.strokeStyle,
            fillStyle: this.fillStyle,
          };
        }
        break;

      case "grab":
        this.startX = e.clientX;
        this.startY = e.clientY;
    }

    if (!shape) {
      return;
    }

    this.saveState();
    this._addShapeToCRDT(shape);
    this.notifyShapeCountChange();

    if (this.sendMessage && this.roomId) {
      this.clearCanvas();

      const message = {
        type: WsDataType.DRAW,
        id: shape.id,
        message: shape,
        roomId: this.roomId,
      };

      try {
        this.sendMessage?.(JSON.stringify(message));
      } catch (e) {
        MessageQueue.enqueue({
          type: WsDataType.UPDATE,
          id: shape.id,
          message: JSON.stringify(shape),
          connectionId: this.connectionId!,
          roomId: this.roomId,
          userId: this.userId!,
          userName: this.userName!,
          timestamp: new Date().toISOString(),
          participants: null,
        });
        console.error("Error sending shape update ws message", e);
      }
    }
  this.streamingShapeId = null;
  this.clearCanvas();
  this.clicked = false;
  this.isDraggingCanvas = false;
}
};

mouseWheelHandler = (e: WheelEvent) => {
  e.preventDefault();

  if (e.ctrlKey || e.metaKey) {
    const scaleAmount = -e.deltaY / 200;
    const newScale = this.scale * (1 + scaleAmount);

    const mouseX = e.clientX - this.canvas.offsetLeft;
    const mouseY = e.clientY - this.canvas.offsetTop;

    const canvasMouseX = (mouseX - this.panX) / this.scale;
    const canvasMouseY = (mouseY - this.panY) / this.scale;

    this.panX -= canvasMouseX * (newScale - this.scale);
    this.panY -= canvasMouseY * (newScale - this.scale);

    this.scale = newScale;

    this.onScaleChange(this.scale);
  } else {
    this.panX -= e.deltaX;
    this.panY -= e.deltaY;
  }

  this.clearCanvas();
};

mouseMoveHandler = (e: MouseEvent) => {
  if (this.isDraggingCanvas) {
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.panX += dx;
    this.panY += dy;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.clearCanvas();
    return;
  }

  const { x, y } = this.transformPanScale(e.clientX, e.clientY);

  if (this.activeTool === "selection") {
    if (this.isMarqueeSelecting) {
      this.marqueeCurrentX = x;
      this.marqueeCurrentY = y;
      this.clearCanvas();
    } else if (this.SelectionController.isDraggingShape()) {
      this.SelectionController.updateDragging(x, y, this.existingShapes);
      this.clearCanvas();
    } else if (this.SelectionController.isResizingShape()) {
      this.SelectionController.updateResizing(x, y);
      this.clearCanvas();
    } else if (!this.clicked) {
      // Phase 2 UX Polish: Hover affordance resolution
      const shapeAtCursor = this.getShapeAtPoint(x, y);
      const targetId = shapeAtCursor ? (this.groupManager.resolveSelection(shapeAtCursor, this.existingShapes)[0]?.id ?? shapeAtCursor.id) : null;
      if (this.hoveredShapeId !== targetId) {
        this.hoveredShapeId = targetId || null;
        this.clearCanvas();
      }
      
      // Update cursor if hovering over a resize handle
      if (this.SelectionController.hasSelection()) {
        const handle = this.SelectionController.getResizeHandleAtPoint(x, y);
        if (handle) {
          this.canvas.style.cursor = handle.cursor;
        } else if (targetId && this.SelectionController.getSelectedShapes().find(s => s.id === targetId)) {
          this.canvas.style.cursor = "move";
        } else {
          this.canvas.style.cursor = "default";
        }
      } else {
        this.canvas.style.cursor = targetId ? "pointer" : "default";
      }
    }
    return;
  }
  
  if (this.activeTool === "lasso") {
    if (this.isLassoSelecting) {
      this.lassoPoints.push({ x, y });
      this.clearCanvas();
    }
    return;
  }

  if (!this.isStandalone && this.isConnected) {
    if (this.cursorThrottleTimeout === null) {
      this.cursorThrottleTimeout = window.setTimeout(() => {
        const coords = this.transformPanScale(e.clientX, e.clientY);

        const payload: any = { 
            x: coords.x, 
            y: coords.y,
            selectionIds: this.SelectionController.getSelectedShapes().map(s => s.id),
            isEditing: this.SelectionController.isDraggingShape() || this.SelectionController.isResizingShape() || !!this.activeTextarea,
            viewport: {
                x: -this.panX / this.scale,
                y: -this.panY / this.scale,
                w: this.canvas.width / this.scale,
                h: this.canvas.height / this.scale
            }
        };
        if (this.activeTool === "laser" && this.clicked) {
            payload.isLaser = true;
            payload.strokeFill = this.strokeFill;
        }

        const message = {
          type: WsDataType.CURSOR_MOVE,
          roomId: this.roomId,
          userId: this.userId!,
          userName: this.userName!,
          connectionId: this.connectionId,
          message: JSON.stringify(payload),
        };

        try {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
          }
        } catch (e) {
          console.error("Error sending streaming CURSOR_MOVE: ", e);
        }

        this.cursorThrottleTimeout = null;
      }, 50);
    }
  }

  if (this.clicked) {
    const snappedX = this.isSnapToGrid ? Math.round(x / 20) * 20 : x;
    const snappedY = this.isSnapToGrid ? Math.round(y / 20) * 20 : y;

    const width = snappedX - this.startX;
    const height = snappedY - this.startY;

    this.clearCanvas();

    let streamingShape: Shape | null = null;

    switch (this.activeTool) {
      case "embed":
        streamingShape = {
          id: this.streamingShapeId || uuidv4(),
          type: "embed",
          x: this.startX,
          y: this.startY,
          width,
          height,
          url: "streaming..."
        };
        this.drawRect(
          this.startX,
          this.startY,
          width,
          height,
          this.strokeWidth,
          this.strokeFill,
          this.bgFill,
          this.strokeEdge,
          this.strokeStyle,
          this.roughStyle,
          this.fillStyle
        );
        break;

      case "frame":
        streamingShape = {
          id: this.streamingShapeId || uuidv4(),
          type: "frame",
          x: this.startX,
          y: this.startY,
          width,
          height,
          frameName: "Streaming Frame"
        };
        this.drawRect(
          this.startX,
          this.startY,
          width,
          height,
          this.strokeWidth,
          this.strokeFill,
          this.bgFill,
          this.strokeEdge,
          this.strokeStyle,
          this.roughStyle,
          this.fillStyle
        );
        break;

      case "rectangle":
        streamingShape = {
          id: this.streamingShapeId || uuidv4(),
          type: "rectangle",
          x: this.startX,
          y: this.startY,
          width,
          height,
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          bgFill: this.bgFill,
          rounded: this.strokeEdge,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
          fillStyle: this.fillStyle,
        };
        this.drawRect(
          this.startX,
          this.startY,
          width,
          height,
          this.strokeWidth,
          this.strokeFill,
          this.bgFill,
          this.strokeEdge,
          this.strokeStyle,
          this.roughStyle,
          this.fillStyle
        );
        break;

      case "ellipse":
        streamingShape = {
          id: this.streamingShapeId || uuidv4(),
          type: "ellipse",
          x: this.startX + width / 2,
          y: this.startY + height / 2,
          radX: Math.abs(width / 2),
          radY: Math.abs(height / 2),
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          bgFill: this.bgFill,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
          fillStyle: this.fillStyle,
        };
        this.drawEllipse(
          this.startX + width / 2,
          this.startY + height / 2,
          Math.abs(width / 2),
          Math.abs(height / 2),
          this.strokeWidth,
          this.strokeFill,
          this.bgFill,
          this.strokeStyle,
          this.roughStyle,
          this.fillStyle
        );
        break;

      case "diamond":
        streamingShape = {
          id: this.streamingShapeId || uuidv4(),
          type: "diamond",
          x: this.startX,
          y: this.startY,
          width: Math.abs(snappedX - this.startX) * 2,
          height: Math.abs(snappedY - this.startY) * 2,
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          bgFill: this.bgFill,
          rounded: this.strokeEdge,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
          fillStyle: this.fillStyle,
        };
        this.drawDiamond(
          this.startX,
          this.startY,
          Math.abs(snappedX - this.startX) * 2,
          Math.abs(snappedY - this.startY) * 2,
          this.strokeWidth,
          this.strokeFill,
          this.bgFill,
          this.strokeEdge,
          this.strokeStyle,
          this.roughStyle,
          this.fillStyle
        );
        break;

      case "line":
        streamingShape = {
          id: this.streamingShapeId || uuidv4(),
          type: "line",
          x: this.startX,
          y: this.startY,
          toX: snappedX,
          toY: snappedY,
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
        };
        this.drawLine(
          this.startX,
          this.startY,
          snappedX,
          snappedY,
          this.strokeWidth,
          this.strokeFill,
          this.strokeStyle,
          this.roughStyle,
          false
        );
        break;

      case "arrow":
        streamingShape = {
          id: this.streamingShapeId || uuidv4(),
          type: "arrow",
          x: this.startX,
          y: this.startY,
          toX: snappedX,
          toY: snappedY,
          strokeWidth: this.strokeWidth,
          strokeFill: this.strokeFill,
          strokeStyle: this.strokeStyle,
          roughStyle: this.roughStyle,
        };
        this.drawLine(
          this.startX,
          this.startY,
          snappedX,
          snappedY,
          this.strokeWidth,
          this.strokeFill,
          this.strokeStyle,
          this.roughStyle,
          true
        );
        break;

      case "free-draw":
        const currentShape =
          this.existingShapes[this.existingShapes.length - 1];
        if (currentShape?.type === "free-draw") {
          currentShape.points.push({ x: snappedX, y: snappedY });
          this.drawFreeDraw(
            currentShape.points,
            this.strokeFill,
            this.bgFill,
            this.strokeStyle,
            this.fillStyle,
            this.strokeWidth
          );
          streamingShape = currentShape;
        }
        break;

      case "laser":
        if (this.laserStrokes.length > 0) {
          const currentStroke = this.laserStrokes[this.laserStrokes.length - 1];
          currentStroke.points.push({ x: snappedX, y: snappedY, time: Date.now() });
          if (!this.laserAnimFrameId) {
            this.laserAnimFrameId = requestAnimationFrame(this.updateLaserAnimation);
          }
        }
        break;

      case "eraser":
        this.eraser(x, y);
        break;
    }
    if (streamingShape && !this.isStandalone) {
      this.streamShape(streamingShape);
    }
  }
};

touchStartHandler = (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  if (!touch) return;

  const simulatedMouse = new MouseEvent("mousedown", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });

  this.mouseDownHandler(simulatedMouse);
};

touchMoveHandler = (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  if (!touch) return;

  const simulatedMouse = new MouseEvent("mousemove", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });

  this.mouseMoveHandler(simulatedMouse);
};

touchEndHandler = (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  if (touch) {
    const simulatedMouse = new MouseEvent("mouseup", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    this.mouseUpHandler(simulatedMouse);
  }
};

  private handleTexty(e: MouseEvent) {
  const { x, y } = this.transformPanScale(e.clientX, e.clientY);

  const textarea = document.createElement("textarea");
  this.activeTextarea = textarea;
  this.activeTextPosition = { x, y };
  Object.assign(textarea.style, {
    position: "absolute",
    display: "inline-block",
    backfaceVisibility: "hidden",
    margin: "0",
    padding: "0",
    border: `1px dotted ${this.strokeFill}`,
    outline: "0",
    resize: "none",
    background: "transparent",
    overflowX: "hidden",
    overflowY: "hidden",
    overflowWrap: "normal",
    boxSizing: "content-box",
    wordBreak: "normal",
    whiteSpace: "pre",
    transform: `translate(${x * this.scale + this.panX}px, ${y * this.scale + this.panY}px)`,
    verticalAlign: "top",
    opacity: "1",
    wrap: "off",
    tabIndex: 0,
    dir: "auto",
    scrollbarWidth: "none", // Firefox
    msOverflowStyle: "none", // IE/Edge
    width: "auto",
    minHeight: "auto",
  });
  const calFont = getFontSize(this.fontSize, this.scale);
  textarea.classList.add("collabydraw-texty");
  textarea.style.color = this.strokeFill;
  const fontString = `${calFont}px/1.2 ${this.fontFamily === "normal" ? "Arial" : this.fontFamily === "hand-drawn" ? "Collabyfont, Xiaolai" : "Assistant"}`;
  textarea.style.font = fontString;
  textarea.style.zIndex = "100";

  const rawMaxWidth =
    window.innerWidth || document.documentElement.clientWidth;
  const rawMaxHeight =
    window.innerHeight || document.documentElement.clientHeight;

  const calMaxWidth = rawMaxWidth - x - TEXT_ADJUSTED_HEIGHT;
  const calMaxHeight = rawMaxHeight - y - TEXT_ADJUSTED_HEIGHT;

  textarea.style.maxWidth = `${calMaxWidth}px`;
  textarea.style.maxHeight = `${calMaxHeight}px`;

  const collabydrawContainer = document.querySelector(
    ".collabydraw-textEditorContainer"
  );

  if (collabydrawContainer) {
    collabydrawContainer.appendChild(textarea);
    setTimeout(() => textarea.focus(), 0);
  } else {
    console.error("Text editor container not found");
    return;
  }

  let hasUnsavedChanges = false;

  let span: HTMLSpanElement | null = null;

  const resizeTextarea = () => {
    if (span && document.body.contains(span)) {
      document.body.removeChild(span);
    }

    span = document.createElement("span");
    Object.assign(span.style, {
      visibility: "hidden",
      position: "absolute",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      font: textarea.style.font,
      padding: "0",
      margin: "0",
      lineHeight: "1.2",
    });

    span.textContent = textarea.value || " ";
    document.body.appendChild(span);

    requestAnimationFrame(() => {
      textarea.style.width = `${Math.max(span!.offsetWidth + TEXT_ADJUSTED_HEIGHT, TEXT_ADJUSTED_HEIGHT)}px`;
      textarea.style.height = `${Math.max(span!.offsetHeight + TEXT_ADJUSTED_HEIGHT, TEXT_ADJUSTED_HEIGHT)}px`;
      textarea.style.overflow = "scroll";
    });
  };

  // NOTE: The definitive 'input' and 'keydown' listeners are registered
  // below (after `save` is defined) so they also have access to `save`.
  // We trigger resizeTextarea here via a dedicated input listener only.
  textarea.addEventListener("input", () => {
    resizeTextarea();
  });

  let saveCalled = false;
  const save = () => {
    if (saveCalled) return;
    saveCalled = true;
    const text = textarea.value.trim();
    if (!text) {
      textarea.remove();
      if (span && document.body.contains(span)) {
        document.body.removeChild(span);
      }
      return;
    }
    if (!span) {
      throw new Error("Span is null");
    }
    this.activeTextarea = null;
    this.activeTextPosition = null;
    const newShape: Shape = {
      id: uuidv4(),
      type: "text",
      x: x,
      y: y,
      width: textarea.offsetWidth,
      height: textarea.offsetHeight - TEXT_ADJUSTED_HEIGHT,
      text,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fontStyle: this.fontStyle,
      textAlign: this.textAlign,
      strokeFill: this.strokeFill,
    };

    this.saveState();
    this._addShapeToCRDT(newShape);
    this.notifyShapeCountChange();

    if (this.sendMessage && this.roomId) {
      this.sendMessage(
        JSON.stringify({
          type: WsDataType.DRAW,
          id: newShape.id,
          message: newShape,
          roomId: this.roomId,
        })
      );
    }

    if (collabydrawContainer?.contains(textarea)) {
      collabydrawContainer.removeChild(textarea);
      if (span && document.body.contains(span)) {
        document.body.removeChild(span);
      }
    }

    this.clearCanvas();
    hasUnsavedChanges = false;
  };

  textarea.addEventListener("input", () => {
    hasUnsavedChanges = true;
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      // Plain Enter: only resize (already handled above)
      resizeTextarea();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  });

  const handleClickOutside = (e: MouseEvent) => {
    if (!textarea.contains(e.target as Node)) {
      document.removeEventListener("mousedown", handleClickOutside);
      save();
    }
  };

  setTimeout(() => {
    document.addEventListener("mousedown", handleClickOutside);
  }, 100);

  textarea.addEventListener("blur", () => {
    document.removeEventListener("mousedown", handleClickOutside);
    if (hasUnsavedChanges) {
      save();
    }
  });
}

  private handleSticky(e: MouseEvent) {
  const { x, y } = this.transformPanScale(e.clientX, e.clientY);

  const stickyWidth = 200;
  const stickyHeight = 200;
  const startX = x - stickyWidth / 2;
  const startY = y - stickyHeight / 2;

  const textarea = document.createElement("textarea");
  this.activeTextarea = textarea;
  this.activeTextPosition = { x: startX, y: startY };

  const tempShape: Shape = {
    id: uuidv4(),
    type: "sticky",
    x: startX,
    y: startY,
    width: stickyWidth,
    height: stickyHeight,
    text: "",
    fontSize: this.fontSize,
    fontFamily: this.fontFamily,
    fontStyle: this.fontStyle,
    textAlign: "center",
    strokeFill: this.strokeFill,
    bgFill: this.bgFill,
    rounded: "sharp",
    strokeStyle: this.strokeStyle,
    roughStyle: this.roughStyle,
  };

  this.saveState();
  this._addShapeToCRDT(tempShape);
  this.notifyShapeCountChange();
  this.clearCanvas();

  const padding = 20;

  Object.assign(textarea.style, {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0",
    padding: `${padding}px`,
    border: "none",
    outline: "none",
    resize: "none",
    background: "transparent",
    overflow: "hidden",
    boxSizing: "border-box",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    transform: `translate(${startX * this.scale + this.panX}px, ${startY * this.scale + this.panY}px)`,
    width: `${stickyWidth * this.scale}px`,
    height: `${stickyHeight * this.scale}px`,
    zIndex: "100",
    textAlign: "center",
    color: this.strokeFill,
  });

  const calFont = getFontSize(this.fontSize, this.scale);
  textarea.style.font = `${calFont}px/1.2 ${this.fontFamily === "normal" ? "Arial" : this.fontFamily === "hand-drawn" ? "Collabyfont, Xiaolai" : "Assistant"}`;

  const collabydrawContainer = document.querySelector(".collabydraw-textEditorContainer");
  if (collabydrawContainer) {
    collabydrawContainer.appendChild(textarea);
    setTimeout(() => textarea.focus(), 0);
  } else {
    return;
  }

  let hasUnsavedChanges = false;
  let saveCalled = false;

  const save = () => {
    if (saveCalled) return;
    saveCalled = true;
    const text = textarea.value.trim();

    const index = this.existingShapes.findIndex(s => s.id === tempShape.id);
    if (index !== -1) {
      if (!text) {
        this._removeShapeFromCRDT(tempShape.id);
        this.notifyShapeCountChange();
      } else {
        const updatedShape = {
          ...tempShape,
          text
        } as Shape;
        this._updateShapeInCRDT(updatedShape);
      }
    }

    this.activeTextarea = null;
    this.activeTextPosition = null;

    if (this.sendMessage && this.roomId && text && index !== -1) {
      this.sendMessage(JSON.stringify({ type: WsDataType.DRAW, id: tempShape.id, message: this.existingShapes[index], roomId: this.roomId }));
    }

    if (collabydrawContainer?.contains(textarea)) {
      collabydrawContainer.removeChild(textarea);
    }
    this.clearCanvas();
    hasUnsavedChanges = false;
  };

  textarea.addEventListener("input", () => { hasUnsavedChanges = true; });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  });

  const handleClickOutside = (e: MouseEvent) => {
    if (!textarea.contains(e.target as Node)) {
      document.removeEventListener("mousedown", handleClickOutside);
      save();
    }
  };
  setTimeout(() => { document.addEventListener("mousedown", handleClickOutside); }, 100);
  textarea.addEventListener("blur", () => {
    document.removeEventListener("mousedown", handleClickOutside);
    if (hasUnsavedChanges) save();
  });
}

  private handleImageUpload(x: number, y: number) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.processImageFile(file, x, y);
  };
  input.click();
  this.activeTool = "selection";
}

  private async handleCardUpload(x: number, y: number, url: string, type: "github_card" | "jira_card") {
    // Show a loading text shape temporarily
    const loadingId = uuidv4();
    const loadingShape: Shape = {
      id: loadingId,
      type: "text",
      x,
      y,
      width: 200,
      height: 40,
      text: "Loading integration...",
      fontSize: "Medium",
      fontFamily: "normal",
      fontStyle: "normal",
      textAlign: "center",
      strokeFill: "#888",
    };
    this._addShapeToCRDT(loadingShape);
    this.clearCanvas();

    try {
      const provider = type === "github_card" ? "github" : "jira";
      const res = await fetch(`/api/integrations/${provider}?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      // Remove loading shape
      this._removeShapeFromCRDT(loadingId);

      const cardShape: Shape = {
        id: uuidv4(),
        type,
        x,
        y,
        width: 320,
        height: 120,
        url: data.url || url,
        title: data.title || "Unknown Issue",
        status: data.status || "UNKNOWN",
      };

      this.saveState();
      this._addShapeToCRDT(cardShape);
      this.notifyShapeCountChange();

      if (this.sendMessage && this.roomId) {
        this.sendMessage(JSON.stringify({ type: WsDataType.DRAW, id: cardShape.id, message: cardShape, roomId: this.roomId }));
      }
    } catch (e) {
      console.error(e);
      this._removeShapeFromCRDT(loadingId);
      alert("Failed to load integration card.");
    }
    this.clearCanvas();
  }

  private processImageFile(file: File, x: number, y: number) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const maxDim = 800;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const startX = x - width / 2;
      const startY = y - height / 2;

      const shape: Shape = {
        id: uuidv4(),
        type: "image",
        x: startX,
        y: startY,
        width,
        height,
        dataUrl,
      };

      this.saveState();
      this._addShapeToCRDT(shape);
      this.notifyShapeCountChange();

      if (this.sendMessage && this.roomId) {
        this.sendMessage(
          JSON.stringify({
            type: WsDataType.DRAW,
            id: shape.id,
            message: shape,
            roomId: this.roomId,
          })
        );
      }
      this.clearCanvas();
    };
    img.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
}

  private drawImageShape(shape: any) {
  let img = this.imageCache.get(shape.id);
  if (!img) {
    img = new Image();
    img.src = shape.dataUrl;
    this.imageCache.set(shape.id, img);
    img.onload = () => {
      this.clearCanvas();
    };
  }
  if (img.complete && img.naturalWidth !== 0) {
    this.ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
  }
}

isPointInShape(x: number, y: number, shape: Shape): boolean {
  const tolerance = ERASER_TOLERANCE;

  switch (shape.type) {
    case "rectangle":
    case "image":
    case "sticky": {
      const startX = Math.min(shape.x, shape.x + shape.width);
      const endX = Math.max(shape.x, shape.x + shape.width);
      const startY = Math.min(shape.y, shape.y + shape.height);
      const endY = Math.max(shape.y, shape.y + shape.height);

      return (
        x >= startX - tolerance &&
        x <= endX + tolerance &&
        y >= startY - tolerance &&
        y <= endY + tolerance
      );
    }
    case "ellipse": {
      const dx = x - shape.x;
      const dy = y - shape.y;
      const normalized =
        (dx * dx) / ((shape.radX + tolerance) * (shape.radX + tolerance)) +
        (dy * dy) / ((shape.radY + tolerance) * (shape.radY + tolerance));
      return normalized <= 1;
    }
    case "diamond": {
      const dx = Math.abs(x - shape.x);
      const dy = Math.abs(y - shape.y);

      return (
        dx / (shape.width / 2 + tolerance) +
        dy / (shape.height / 2 + tolerance) <=
        1
      );
    }
    case "line": {
      const lineLength = Math.hypot(shape.toX - shape.x, shape.toY - shape.y);
      const distance =
        Math.abs(
          (shape.toY - shape.y) * x -
          (shape.toX - shape.x) * y +
          shape.toX * shape.y -
          shape.toY * shape.x
        ) / lineLength;

      const withinLineBounds =
        x >= Math.min(shape.x, shape.toX) - tolerance &&
        x <= Math.max(shape.x, shape.toX) + tolerance &&
        y >= Math.min(shape.y, shape.toY) - tolerance &&
        y <= Math.max(shape.y, shape.toY) + tolerance;

      return distance <= tolerance && withinLineBounds;
    }
    case "arrow": {
      const lineLength = Math.hypot(shape.toX - shape.x, shape.toY - shape.y);
      const distance =
        Math.abs(
          (shape.toY - shape.y) * x -
          (shape.toX - shape.x) * y +
          shape.toX * shape.y -
          shape.toY * shape.x
        ) / lineLength;

      const withinLineBounds =
        x >= Math.min(shape.x, shape.toX) - tolerance &&
        x <= Math.max(shape.x, shape.toX) + tolerance &&
        y >= Math.min(shape.y, shape.toY) - tolerance &&
        y <= Math.max(shape.y, shape.toY) + tolerance;

      return distance <= tolerance && withinLineBounds;
    }
    case "free-draw": {
      return shape.points.some(
        (point) => Math.hypot(point.x - x, point.y - y) <= tolerance
      );
    }

    case "text": {
      const startX = shape.x;
      const endX = shape.x + (shape.width || 0);
      const startY = shape.y;
      // Use the stored shape.height (actual multi-line rendered height);
      // fall back to the single-line FONT_SIZE_MAP value only when height is missing.
      const textHeight = shape.height || FONT_SIZE_MAP[shape.fontSize];
      const endY = shape.y + textHeight;

      return (
        x >= startX - tolerance &&
        x <= endX + tolerance &&
        y >= startY - tolerance &&
        y <= endY + tolerance
      );
    }

    default:
      return false;
  }
}

transformPanScale(
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = this.canvas.getBoundingClientRect();
  const x = (clientX - rect.left - this.panX) / this.scale;
  const y = (clientY - rect.top - this.panY) / this.scale;
  return { x, y };
}

drawRect(
  x: number,
  y: number,
  width: number,
  height: number,
  strokeWidth: number,
  strokeFill: string,
  bgFill: string,
  rounded: StrokeEdge,
  strokeStyle: StrokeStyle,
  roughStyle: RoughStyle,
  fillStyle: FillStyle
) {
  const posX = width < 0 ? x + width : x;
  const posY = height < 0 ? y + height : y;
  const normalizedWidth = Math.abs(width);
  const normalizedHeight = Math.abs(height);
  if (roughStyle === 0) {
    const radius = Math.min(
      Math.abs(
        Math.max(normalizedWidth, normalizedHeight) /
        RECT_CORNER_RADIUS_FACTOR
      ),
      normalizedWidth / 2,
      normalizedHeight / 2
    );

    this.ctx.beginPath();
    this.ctx.strokeStyle = strokeFill;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.fillStyle = bgFill;

    this.ctx.setLineDash(
      strokeStyle === "dashed"
        ? getDashArrayDashed(strokeWidth)
        : strokeStyle === "dotted"
          ? getDashArrayDotted(strokeWidth)
          : []
    );

    this.ctx.roundRect(
      posX,
      posY,
      normalizedWidth,
      normalizedHeight,
      rounded === "round" ? [radius] : [0]
    );

    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  } else {
    const options = this.getRoughOptions(
      strokeWidth,
      strokeFill,
      roughStyle,
      bgFill,
      strokeStyle,
      fillStyle
    );

    if (rounded === "round") {
      const r =
        Math.min(normalizedWidth, normalizedHeight) * ROUND_RADIUS_FACTOR;

      this.roughCanvas.path(
        `M ${posX + r} ${posY} 
           L ${posX + normalizedWidth - r} ${posY} 
           Q ${posX + normalizedWidth} ${posY}, ${posX + normalizedWidth} ${posY + r} 
           L ${posX + normalizedWidth} ${posY + normalizedHeight - r} 
           Q ${posX + normalizedWidth} ${posY + normalizedHeight}, ${posX + normalizedWidth - r} ${posY + normalizedHeight} 
           L ${posX + r} ${posY + normalizedHeight} 
           Q ${posX} ${posY + normalizedHeight}, ${posX} ${posY + normalizedHeight - r} 
           L ${posX} ${posY + r} 
           Q ${posX} ${posY}, ${posX + r} ${posY} 
           Z`,
        options
      );
    } else {
      this.roughCanvas.rectangle(
        posX,
        posY,
        normalizedWidth,
        normalizedHeight,
        options
      );
    }
  }
}

drawEllipse(
  x: number,
  y: number,
  width: number,
  height: number,
  strokeWidth: number,
  strokeFill: string,
  bgFill: string,
  strokeStyle: StrokeStyle,
  roughStyle: RoughStyle,
  fillStyle: FillStyle
) {
  if (roughStyle === 0) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = strokeFill;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.setLineDash(
      strokeStyle === "dashed"
        ? getDashArrayDashed(strokeWidth)
        : strokeStyle === "dotted"
          ? getDashArrayDotted(strokeWidth)
          : []
    );
    this.ctx.fillStyle = bgFill;
    this.ctx.ellipse(
      x,
      y,
      width < 0 ? 1 : width,
      height < 0 ? 1 : height,
      0,
      0,
      2 * Math.PI
    );
    this.ctx.fill();
    this.ctx.stroke();
  } else {
    const options = this.getRoughOptions(
      strokeWidth,
      strokeFill,
      roughStyle,
      bgFill,
      strokeStyle,
      fillStyle,
      60,
      "ellipse"
    );
    this.roughCanvas.ellipse(
      x,
      y,
      width < 0 ? 2 : width * 2,
      height < 0 ? 2 : height * 2,
      options
    );
  }
}

drawDiamond(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  strokeWidth: number,
  strokeFill: string,
  bgFill: string,
  rounded: StrokeEdge,
  strokeStyle: StrokeStyle,
  roughStyle: RoughStyle,
  fillStyle: FillStyle
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const normalizedWidth = Math.abs(halfWidth);
  const normalizedHeight = Math.abs(halfHeight);

  if (roughStyle === 0) {
    this.ctx.setLineDash(
      strokeStyle === "dashed"
        ? getDashArrayDashed(strokeWidth)
        : strokeStyle === "dotted"
          ? getDashArrayDotted(strokeWidth)
          : []
    );

    if (rounded === "round") {
      const cornerRadiusPercentage: number = DIAMOND_CORNER_RADIUS_PERCENTAGE;

      const sideLength = Math.min(
        Math.sqrt(
          Math.pow(normalizedWidth, 2) + Math.pow(normalizedHeight, 2)
        ),
        2 * normalizedWidth,
        2 * normalizedHeight
      );

      let radius = (sideLength * cornerRadiusPercentage) / 100;

      const maxRadius = Math.min(normalizedWidth, normalizedHeight) * 0.4;
      radius = Math.min(radius, maxRadius);

      const topPoint = { x: centerX, y: centerY - halfHeight };
      const rightPoint = { x: centerX + halfWidth, y: centerY };
      const bottomPoint = { x: centerX, y: centerY + halfHeight };
      const leftPoint = { x: centerX - halfWidth, y: centerY };

      this.ctx.save();

      this.ctx.beginPath();

      const distTopLeft = Math.sqrt(
        Math.pow(topPoint.x - leftPoint.x, 2) +
        Math.pow(topPoint.y - leftPoint.y, 2)
      );

      const startX =
        leftPoint.x + ((topPoint.x - leftPoint.x) * radius) / distTopLeft;
      const startY =
        leftPoint.y + ((topPoint.y - leftPoint.y) * radius) / distTopLeft;

      this.ctx.moveTo(startX, startY);

      this.ctx.arcTo(
        topPoint.x,
        topPoint.y,
        rightPoint.x,
        rightPoint.y,
        radius
      );

      this.ctx.arcTo(
        rightPoint.x,
        rightPoint.y,
        bottomPoint.x,
        bottomPoint.y,
        radius
      );

      this.ctx.arcTo(
        bottomPoint.x,
        bottomPoint.y,
        leftPoint.x,
        leftPoint.y,
        radius
      );

      this.ctx.arcTo(
        leftPoint.x,
        leftPoint.y,
        topPoint.x,
        topPoint.y,
        radius
      );

      this.ctx.lineTo(startX, startY);
      this.ctx.closePath();

      this.ctx.fillStyle = bgFill;
      this.ctx.strokeStyle = strokeFill;
      this.ctx.lineWidth = strokeWidth;

      this.ctx.fill();
      this.ctx.stroke();
    } else {
      this.ctx.beginPath();
      this.ctx.strokeStyle = strokeFill;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.fillStyle = bgFill;

      this.ctx.moveTo(centerX, centerY - halfHeight);
      this.ctx.lineTo(centerX + halfWidth, centerY);
      this.ctx.lineTo(centerX, centerY + halfHeight);
      this.ctx.lineTo(centerX - halfWidth, centerY);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }
  } else {
    const options = this.getRoughOptions(
      strokeWidth,
      strokeFill,
      roughStyle,
      bgFill,
      strokeStyle,
      fillStyle
    );

    const diamondPoints: Point[] = [
      [centerX, centerY - halfHeight],
      [centerX + halfWidth, centerY],
      [centerX, centerY + halfHeight],
      [centerX - halfWidth, centerY],
    ];

    this.roughCanvas.polygon(diamondPoints, options);
  }
}

drawLine(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strokeWidth: number,
  strokeFill: string,
  strokeStyle: StrokeStyle,
  roughStyle: RoughStyle,
  arrowHead: boolean
) {
  if (roughStyle === 0) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = strokeFill;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.setLineDash(
      strokeStyle === "dashed"
        ? getDashArrayDashed(strokeWidth)
        : strokeStyle === "dotted"
          ? getDashArrayDotted(strokeWidth)
          : []
    );
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();
  } else {
    const options = this.getRoughOptions(
      strokeWidth,
      strokeFill,
      roughStyle,
      undefined,
      strokeStyle
    );
    this.roughCanvas.line(fromX, fromY, toX, toY, options);
  }

  if (arrowHead) {
    const angleHeadAngle = Math.atan2(toY - fromY, toX - fromX);
    const length = ARROW_HEAD_LENGTH * (strokeStyle !== "solid" ? 2 : 1);

    const arrowX1 = toX - length * Math.cos(angleHeadAngle - Math.PI / 6);
    const arrowY1 = toY - length * Math.sin(angleHeadAngle - Math.PI / 6);
    const arrowX2 = toX - length * Math.cos(angleHeadAngle + Math.PI / 6);
    const arrowY2 = toY - length * Math.sin(angleHeadAngle + Math.PI / 6);

    if (roughStyle === 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(toX, toY);
      this.ctx.lineTo(arrowX1, arrowY1);
      this.ctx.moveTo(toX, toY);
      this.ctx.lineTo(arrowX2, arrowY2);
      this.ctx.stroke();
    } else {
      const options = this.getRoughOptions(
        strokeWidth,
        strokeFill,
        roughStyle
      );
      this.roughCanvas.line(toX, toY, arrowX1, arrowY1, options);
      this.roughCanvas.line(toX, toY, arrowX2, arrowY2, options);
    }
  }
}

drawFreeDraw(
  points: { x: number; y: number }[],
  strokeFill: string,
  bgFill: string,
  strokeStyle: StrokeStyle,
  fillStyle: FillStyle,
  strokeWidth: StrokeWidth
) {
  if (!points.length) return;

  // const svgPathData = generateFreeDrawPath(points, strokeWidth);

  if (fillStyle === "solid") {
    const path = new Path2D(generateFreeDrawPath(points, strokeWidth));

    this.ctx.save();
    this.ctx.fillStyle = strokeFill;
    this.ctx.fill(path);

    if (strokeStyle === "dashed" || strokeStyle === "dotted") {
      this.ctx.strokeStyle = strokeFill;
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash(
        strokeStyle === "dashed"
          ? getDashArrayDashed(1)
          : getDashArrayDotted(1)
      );
      this.ctx.stroke(path);
      this.ctx.setLineDash([]);
    }

    this.ctx.restore();
  } else {
    const pathStr = points.reduce(
      (path, point, index) =>
        path +
        (index === 0
          ? `M ${point.x} ${point.y}`
          : ` L ${point.x} ${point.y}`),
      ""
    );

    const options = this.getRoughOptions(
      strokeWidth,
      strokeFill,
      0,
      bgFill,
      "solid",
      fillStyle
    );
    this.roughCanvas.path(pathStr, options);
  }
}

drawText(
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  fillStyle: string,
  fontStyle: FontStyle,
  fontFamily: FontFamily,
  fontSize: FontSize,
  textAlign: TextAlign
) {
  const calFontSize = getFontSize(fontSize, this.scale);
  const lineHeight = getLineHeight(calFontSize);

  const fontString = `${fontStyle} ${calFontSize}px/1.2 ${fontFamily === "normal" ? "Arial" : fontFamily === "hand-drawn" ? "Collabyfont, Xiaolai" : "Assistant"}`;
  this.ctx.font = fontString;
  this.ctx.fillStyle = fillStyle;
  this.ctx.textAlign = textAlign;

  const lines = text.split("\n");

  lines.forEach((line, index) => {
    let tx = x;
    if (textAlign === "center") {
      tx = x + width / 2;
    } else if (textAlign === "right") {
      tx = x + width;
    }
    const ty = y + (index + 1) * lineHeight;
    this.ctx.fillText(line, tx, ty);
  });
}

eraser(x: number, y: number) {
  const shapeIndex = this.existingShapes.findIndex((shape) =>
    this.isPointInShape(x, y, shape)
  );

  if (shapeIndex !== -1) {
    this.saveState();
    const erasedShape = this.existingShapes[shapeIndex];
    if (erasedShape.id) {
      this._removeShapeFromCRDT(erasedShape.id);
    }
    this.notifyShapeCountChange();
    this.clearCanvas();

    if (this.sendMessage && this.roomId) {
      try {
        this.sendMessage?.(
          JSON.stringify({
            type: WsDataType.ERASER,
            id: erasedShape.id,
            roomId: this.roomId,
          })
        );
      } catch (e) {
        MessageQueue.enqueue({
          type: WsDataType.ERASER,
          id: erasedShape.id,
          message: null,
          roomId: this.roomId,
          userId: this.userId!,
          userName: this.userName!,
          timestamp: new Date().toISOString(),
          participants: null,
          connectionId: this.connectionId!,
        });
        console.error("Error sending shape erase ws message", e);
      }
    }
  }
}

onScaleChange(scale: number) {
  this.outputScale = scale;
  if (this.onScaleChangeCallback) {
    this.onScaleChangeCallback(scale);
  }
}

setScale(newScale: number) {
  const rect = this.canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  this.panX -= centerX * (newScale - this.scale);
  this.panY -= centerY * (newScale - this.scale);

  this.scale = newScale;
  this.onScaleChange(this.scale);
  this.clearCanvas();
}

  clearAllShapes() {
    this.saveState();
    this._clearAllCRDT();
    this.notifyShapeCountChange();
    this.clearCanvas();
  }

/** Returns a snapshot of the current shapes — used by minimap and autosave */
getShapes(): Shape[] {
  return [...this.existingShapes];
}


handleResize(width: number, height: number) {
  this.canvas.width = width;
  this.canvas.height = height;

  this.clearCanvas();
}


  public getExistingShape(id: string): Shape | undefined {
  return this.existingShapes.find((shape) => shape.id === id);
}

  public hasShape(id: string): boolean {
  return this.existingShapes.some((shape) => shape.id === id);
}

  public updateShape(updatedShape: Shape): void {
    const index = this.existingShapes.findIndex(
      (shape) => shape.id === updatedShape.id
    );
    if (index !== -1) {
      this._updateShapeInCRDT(updatedShape);
      this.clearCanvas();
      
      // Broadcast update
      if (!this.isStandalone && this.isConnected && this.roomId) {
        try {
          this.sendMessage(JSON.stringify({
            type: WsDataType.UPDATE,
            id: updatedShape.id,
            message: updatedShape,
            roomId: this.roomId,
          }));
        } catch (e) {
          console.error("Error broadcasting shape update:", e);
        }
      }
    }
  }

  public updateShapes(shapes: Shape[]): void {
    shapes.forEach((shape) => {
      const index = this.existingShapes.findIndex((s) => s.id === shape.id);
      const isNew = index === -1;
      
      if (isNew) {
        this._addShapeToCRDT(shape);
      } else {
        this._updateShapeInCRDT(shape);
        const selectedShapes = this.SelectionController.getSelectedShapes();
        const selIndex = selectedShapes.findIndex(s => s.id === shape.id);
        if (selIndex !== -1) {
            const newSelection = [...selectedShapes];
            newSelection[selIndex] = shape;
            this.SelectionController.setSelectedShapes(newSelection);
        }
      }

      // Broadcast
      if (!this.isStandalone && this.isConnected && this.roomId) {
        try {
          this.sendMessage(JSON.stringify({
            type: isNew ? WsDataType.DRAW : WsDataType.UPDATE,
            id: shape.id,
            message: shape,
            roomId: this.roomId,
          }));
        } catch (e) {
          console.error(`Error broadcasting shape ${isNew ? 'draw' : 'update'}:`, e);
        }
      }
    });
    this.clearCanvas();
  }

  public removeShape(id: string): void {
  this._removeShapeFromCRDT(id);
  this.clearCanvas();
}

  private notifyShapeCountChange() {
  this.onShapeCountChange?.(this.existingShapes.length);
}

  public setTheme(newTheme: "light" | "dark") {
  this.currentTheme = newTheme;
  this.clearCanvas();
}

  /** Returns current pan/scale for Rulers component */
  public getViewport(): { panX: number; panY: number; scale: number } {
    return { panX: this.panX, panY: this.panY, scale: this.scale };
  }

  /** Reorder shapes array (for Layers panel drag-reorder) */
  public reorderShapes(ordered: string[]): void {
    const map = new Map(this.existingShapes.map(s => [s.id, s]));
    const reordered = ordered.map(id => map.get(id)).filter(Boolean) as typeof this.existingShapes;
    // Keep any shapes not in ordered list at the end
    const extras = this.existingShapes.filter(s => s.id != null && !(ordered as (string | null)[]).includes(s.id));
    this._setShapesCRDT([...reordered, ...extras]);
    this.clearCanvas();
  }


  private handleKeyDown = (e: KeyboardEvent) => {
  if (this.isReadOnly) return;
  
  if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault();
    this.undo();
    return;
  }
  if ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
    e.preventDefault();
    this.redo();
    return;
  }

  if (this.activeTool === "selection" && this.SelectionController.isShapeSelected()) {
    if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.duplicateSelected();
      return;
    }
    if (e.key === "[" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        this.sendToBack();
      } else {
        this.sendBackward();
      }
      return;
    }
    if (e.key === "]" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        this.bringToFront();
      } else {
        this.bringForward();
      }
      return;
    }
    if (e.key.toLowerCase() === "g" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        this.ungroupSelected();
      } else {
        this.groupSelected();
      }
    }
  }

  if (e.key === "Delete" || e.key === "Backspace") {
    if (this.activeTool === "selection" && this.SelectionController.isShapeSelected()) {
      this.deleteSelected();
    }
  }
};

public duplicateSelected() {
  const selectedShapes = this.SelectionController.getSelectedShapes();
  if (selectedShapes.length === 0) return;
  this.saveState();
  
  const newSelection: Shape[] = [];
  selectedShapes.forEach(selectedShape => {
      const clonedShape = JSON.parse(JSON.stringify(selectedShape));
      clonedShape.id = uuidv4();
    
      if ('x' in clonedShape) clonedShape.x += 20;
      if ('y' in clonedShape) clonedShape.y += 20;
      if ('toX' in clonedShape) clonedShape.toX += 20;
      if ('toY' in clonedShape) clonedShape.toY += 20;
      if ('points' in clonedShape && Array.isArray(clonedShape.points)) {
        clonedShape.points.forEach((p: any) => { p.x += 20; p.y += 20; });
      }
      if ('startShapeId' in clonedShape) delete clonedShape.startShapeId;
      if ('endShapeId' in clonedShape) delete clonedShape.endShapeId;
    
      this._addShapeToCRDT(clonedShape);
      newSelection.push(clonedShape);
  });
  
  this.SelectionController.setSelectedShapes(newSelection);
  this.notifyShapeCountChange();
  this.clearCanvas();
  this.syncAllShapes();
}

public sendBackward() {
  const selectedShapes = this.SelectionController.getSelectedShapes();
  if (selectedShapes.length === 0) return;
  this.saveState();
  
  // Sort by index so we process from front to back, to safely move things backward
  const currentShapes = [...this.existingShapes];
  const indices = selectedShapes.map(s => currentShapes.findIndex(e => e.id === s.id)).filter(i => i !== -1).sort((a, b) => a - b);
  
  indices.forEach(index => {
      if (index > 0) {
        const temp = currentShapes[index - 1];
        currentShapes[index - 1] = currentShapes[index];
        currentShapes[index] = temp;
      }
  });
  this._setShapesCRDT(currentShapes);
  this.clearCanvas();
  this.syncAllShapes();
}

public sendToBack() {
  const selectedShapes = this.SelectionController.getSelectedShapes();
  if (selectedShapes.length === 0) return;
  this.saveState();
  
  const shapesToMove: Shape[] = [];
  selectedShapes.forEach(selectedShape => {
      const index = this.existingShapes.findIndex((s) => s.id === selectedShape.id);
      if (index !== -1) {
          const shape = this.existingShapes[index];
          shapesToMove.push(shape);
      }
  });
  
  // unshift them backwards so their relative order is preserved, wait unshifting in order reverses them. Let's unshift backwards
  const currentShapes = this.existingShapes;
  const filtered = currentShapes.filter(s => !selectedShapes.some(ss => ss.id === s.id));
  this._setShapesCRDT([...shapesToMove, ...filtered]);
  
  this.clearCanvas();
  this.syncAllShapes();
}

public bringForward() {
  const selectedShapes = this.SelectionController.getSelectedShapes();
  if (selectedShapes.length === 0) return;
  this.saveState();
  
  // Process from back to front
  const currentShapes = [...this.existingShapes];
  const indices = selectedShapes.map(s => currentShapes.findIndex(e => e.id === s.id)).filter(i => i !== -1).sort((a, b) => b - a);
  
  indices.forEach(index => {
      if (index < currentShapes.length - 1) {
        const temp = currentShapes[index + 1];
        currentShapes[index + 1] = currentShapes[index];
        currentShapes[index] = temp;
      }
  });
  
  this._setShapesCRDT(currentShapes);
  this.clearCanvas();
  this.syncAllShapes();
}

public bringToFront() {
  const selectedShapes = this.SelectionController.getSelectedShapes();
  if (selectedShapes.length === 0) return;
  this.saveState();
  
  const shapesToMove: Shape[] = [];
  selectedShapes.forEach(selectedShape => {
      const index = this.existingShapes.findIndex((s) => s.id === selectedShape.id);
      if (index !== -1) {
          const shape = this.existingShapes[index];
          shapesToMove.push(shape);
      }
  });
  
  const currentShapes = this.existingShapes;
  const filtered = currentShapes.filter(s => !selectedShapes.some(ss => ss.id === s.id));
  this._setShapesCRDT([...filtered, ...shapesToMove]);
  
  this.clearCanvas();
  this.syncAllShapes();
}

public deleteSelected() {
  const selectedShapes = this.SelectionController.getSelectedShapes();
  if (selectedShapes.length === 0) return;
  
  this.saveState();
  
  selectedShapes.forEach(selectedShape => {
      if (!selectedShape.id) return;
      this.removeShape(selectedShape.id);
      if (!this.isStandalone && this.sendMessage && this.roomId) {
        try {
          this.sendMessage?.(
            JSON.stringify({
              type: WsDataType.ERASER,
              id: selectedShape.id,
              roomId: this.roomId,
            })
          );
        } catch (e) {
          MessageQueue.enqueue({
            type: WsDataType.ERASER,
            id: selectedShape.id,
            message: null,
            roomId: this.roomId,
            userId: this.userId!,
            userName: this.userName!,
            timestamp: new Date().toISOString(),
            participants: null,
            connectionId: this.connectionId!,
          });
          console.error("Error sending shape erase ws message", e);
        }
      }
  });
  
  this.SelectionController.setSelectedShapes([]);
  this.notifyShapeCountChange();

  
  this.clearCanvas();
}

public alignSelectedLeft() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length < 2) return;
    const combinedBounds = this.SelectionController.getCombinedBounds();
    if (!combinedBounds) return;
    
    this.saveState();
    selectedShapes.forEach(shape => {
        const shapeBounds = this.SelectionController.getShapeBounds(shape);
        const dx = combinedBounds.x - shapeBounds.x;
        this.SelectionController.applyOffsetToShape(shape, dx, 0);
    });
    this.clearCanvas();
    this.syncAllShapes();
}

public alignSelectedRight() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length < 2) return;
    const combinedBounds = this.SelectionController.getCombinedBounds();
    if (!combinedBounds) return;
    
    this.saveState();
    selectedShapes.forEach(shape => {
        const shapeBounds = this.SelectionController.getShapeBounds(shape);
        const dx = (combinedBounds.x + combinedBounds.width) - (shapeBounds.x + shapeBounds.width);
        this.SelectionController.applyOffsetToShape(shape, dx, 0);
    });
    this.clearCanvas();
    this.syncAllShapes();
}

public alignSelectedCenterHorizontal() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length < 2) return;
    const combinedBounds = this.SelectionController.getCombinedBounds();
    if (!combinedBounds) return;
    
    this.saveState();
    const centerX = combinedBounds.x + combinedBounds.width / 2;
    selectedShapes.forEach(shape => {
        const shapeBounds = this.SelectionController.getShapeBounds(shape);
        const shapeCenterX = shapeBounds.x + shapeBounds.width / 2;
        const dx = centerX - shapeCenterX;
        this.SelectionController.applyOffsetToShape(shape, dx, 0);
    });
    this.clearCanvas();
    this.syncAllShapes();
}

public alignSelectedTop() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length < 2) return;
    const combinedBounds = this.SelectionController.getCombinedBounds();
    if (!combinedBounds) return;
    
    this.saveState();
    selectedShapes.forEach(shape => {
        const shapeBounds = this.SelectionController.getShapeBounds(shape);
        const dy = combinedBounds.y - shapeBounds.y;
        this.SelectionController.applyOffsetToShape(shape, 0, dy);
    });
    this.clearCanvas();
    this.syncAllShapes();
}

public alignSelectedBottom() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length < 2) return;
    const combinedBounds = this.SelectionController.getCombinedBounds();
    if (!combinedBounds) return;
    
    this.saveState();
    selectedShapes.forEach(shape => {
        const shapeBounds = this.SelectionController.getShapeBounds(shape);
        const dy = (combinedBounds.y + combinedBounds.height) - (shapeBounds.y + shapeBounds.height);
        this.SelectionController.applyOffsetToShape(shape, 0, dy);
    });
    this.clearCanvas();
    this.syncAllShapes();
}

public alignSelectedCenterVertical() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length < 2) return;
    const combinedBounds = this.SelectionController.getCombinedBounds();
    if (!combinedBounds) return;
    
    this.saveState();
    const centerY = combinedBounds.y + combinedBounds.height / 2;
    selectedShapes.forEach(shape => {
        const shapeBounds = this.SelectionController.getShapeBounds(shape);
        const shapeCenterY = shapeBounds.y + shapeBounds.height / 2;
        const dy = centerY - shapeCenterY;
        this.SelectionController.applyOffsetToShape(shape, 0, dy);
    });
    this.clearCanvas();
    this.syncAllShapes();
}

public groupSelected() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length < 2) return;
    
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const bounds = this.groupManager.getGroupBounds(groupId, this.existingShapes);
    
    // Batch all mutations in a single Yjs transaction for multiplayer safety
    this.yDoc.transact(() => {
      // Assign groupId to all member shapes in the CRDT
      selectedShapes.forEach(shape => {
        if (shape.id) {
          const updated = { ...shape, groupId };
          this.yShapes.set(shape.id, updated);
        }
      });
      
      // Persist group descriptor in its own Y.Map for deterministic sync
      const center = bounds
        ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        : { x: 0, y: 0 };
      this.yGroups.set(groupId, { groupId, centerX: center.x, centerY: center.y, rotation: 0 });
    }, this.connectionId || "local");
}

public ungroupSelected() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length === 0) return;
    
    const groupIds = new Set(selectedShapes.map(s => s.groupId).filter(Boolean) as string[]);
    if (groupIds.size === 0) return;
    
    // Batch all mutations in a single Yjs transaction for multiplayer safety
    this.yDoc.transact(() => {
      selectedShapes.forEach(shape => {
        if (shape.id) {
          const { groupId: _removed, ...rest } = shape as any;
          this.yShapes.set(shape.id, rest as Shape);
        }
      });
      // Remove all group descriptors for ungrouped groupIds
      groupIds.forEach(gid => this.yGroups.delete(gid));
    }, this.connectionId || "local");
}

  private saveUndoState() {
    // Replaced by Yjs UndoManager
  }

  private saveState() {
    // Stubbed for backward compatibility
  }


  // Wave 8: Bulk-add shapes (AI / Mermaid).
  public addShapes(shapes: Shape[]) {
    if (!shapes || shapes.length === 0) return;

    this.yDoc.transact(() => {
      shapes.forEach(s => this._addShapeToCRDT(s));
    }, this.connectionId || "local");
    this.notifyShapeCountChange();
    this.clearCanvas();
    this.syncAllShapes();
  }

  // Phase 3C: Apply layout — bulk-update x/y positions returned by AI manipulate API.
  // Matches shapes by id; shapes not found in the update are left untouched.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public applyLayout(updatedShapes: any[]) {
    if (!updatedShapes || updatedShapes.length === 0) return;

    // Build a lookup from id → updated position
    const posMap = new Map<string, { x?: number; y?: number }>();
    for (const s of updatedShapes) {
      if (s.id) posMap.set(s.id, { x: s.x, y: s.y });
    }

    this.yDoc.transact(() => {
      this.existingShapes.forEach(s => {
        const update = s.id ? posMap.get(s.id as string) : undefined;
        if (update) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updated = { ...s } as any;
          if (update.x != null) updated.x = update.x;
          if (update.y != null) updated.y = update.y;
          this._updateShapeInCRDT(updated as Shape);
        }
      });
    }, this.connectionId || "local");

    this.clearCanvas();
    this.syncAllShapes();
  }



  // Phase 5: Export shapes as a portable JSON file
  public exportToJSON() {
    if (this.existingShapes.length === 0) return;
    const json = JSON.stringify(this.existingShapes, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `collabydraw-board-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Phase 5: Copy board as PNG to clipboard
  public async copyPNGToClipboard(): Promise<boolean> {
    if (this.existingShapes.length === 0) return false;
    try {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.existingShapes.forEach(shape => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = shape as any;
        const pad = 20;
        if (s.type === 'free-draw' && s.points) {
          s.points.forEach((p: {x:number;y:number}) => {
            minX = Math.min(minX, p.x - pad); minY = Math.min(minY, p.y - pad);
            maxX = Math.max(maxX, p.x + pad); maxY = Math.max(maxY, p.y + pad);
          });
        } else {
          if (s.x == null) return;
          minX = Math.min(minX, s.x - pad); minY = Math.min(minY, s.y - pad);
          const x2 = s.toX ?? (s.x + (s.width || 0));
          const y2 = s.toY ?? (s.y + (s.height || 0));
          maxX = Math.max(maxX, x2 + pad); maxY = Math.max(maxY, y2 + pad);
        }
      });
      const w = maxX - minX; const h = maxY - minY;
      if (w <= 0 || h <= 0) return false;

      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      const tmpCtx = tmp.getContext("2d");
      if (!tmpCtx) return false;

      const oldCanvas = this.canvas, oldCtx = this.ctx, oldRough = this.roughCanvas;
      const oldPanX = this.panX, oldPanY = this.panY, oldScale = this.scale;
      const oldSel = [...this.SelectionController.getSelectedShapes()];
      this.SelectionController.setSelectedShapes([]);
      this.canvas = tmp; this.ctx = tmpCtx;
      this.roughCanvas = rough.canvas(tmp);
      this.panX = -minX; this.panY = -minY; this.scale = 1;
      this.clearCanvas();
      const dataUrl = tmp.toDataURL("image/png");
      this.canvas = oldCanvas; this.ctx = oldCtx; this.roughCanvas = oldRough;
      this.panX = oldPanX; this.panY = oldPanY; this.scale = oldScale;
      this.SelectionController.setSelectedShapes(oldSel);
      this.clearCanvas();

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    } catch (e) {
      console.error("copyPNGToClipboard failed:", e);
      return false;
    }
  }

  // Phase 5: Export as SVG (vector approximation)
  public exportToSVG() {
    if (this.existingShapes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.existingShapes.forEach(shape => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = shape as any;
      const pad = 20;
      if (s.x == null) return;
      minX = Math.min(minX, s.x - pad); minY = Math.min(minY, s.y - pad);
      maxX = Math.max(maxX, (s.toX ?? s.x + (s.width || 100)) + pad);
      maxY = Math.max(maxY, (s.toY ?? s.y + (s.height || 60)) + pad);
    });
    const vw = maxX - minX; const vh = maxY - minY;
    if (vw <= 0 || vh <= 0) return;

    const svgParts: string[] = [];
    this.existingShapes.forEach(shape => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = shape as any;
      const x = (s.x ?? 0) - minX; const y = (s.y ?? 0) - minY;
      const stroke = s.strokeFill ?? "#ffffff";
      const fill = (s.bgFill && s.bgFill !== "transparent" && s.bgFill !== "#00000000") ? s.bgFill : "none";
      const sw = s.strokeWidth ?? 1.5;
      switch (s.type) {
        case "rectangle":
          svgParts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(s.width||120).toFixed(1)}" height="${(s.height||60).toFixed(1)}" rx="${s.rounded === 'round' ? 8 : 0}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
          break;
        case "ellipse":
          svgParts.push(`<ellipse cx="${(x+(s.radX??60)).toFixed(1)}" cy="${(y+(s.radY??40)).toFixed(1)}" rx="${(s.radX??60).toFixed(1)}" ry="${(s.radY??40).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
          break;
        case "line":
        case "arrow": {
          const tx = (s.toX??s.x+100)-minX; const ty = (s.toY??s.y)-minY;
          svgParts.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}"${s.type==='arrow'?' marker-end="url(#arr)"':''}/>`);
          break;
        }
        case "text":
          svgParts.push(`<text x="${x.toFixed(1)}" y="${(y+16).toFixed(1)}" fill="${stroke}" font-size="14" font-family="sans-serif">${(s.text??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")}</text>`);
          break;
        default: break;
      }
    });

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${vw.toFixed(0)}" height="${vh.toFixed(0)}" viewBox="0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}">\n  <defs><marker id="arr" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#fff"/></marker></defs>\n  <rect width="100%" height="100%" fill="#0a0a0f"/>\n  ${svgParts.join("\n  ")}\n</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `collabydraw-board-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  private syncAllShapes() {
    if (this.isStandalone || !this.isConnected || !this.roomId) return;
    this.existingShapes.forEach(shape => {
      try {
        this.sendMessage(JSON.stringify({
          type: WsDataType.UPDATE,
          id: shape.id,
          message: shape,
          roomId: this.roomId,
        }));
      } catch (e) {
        console.error("[syncAllShapes] failed to broadcast shape", shape.id, e);
      }
    });
  }

  public exportToPNG() {
  if (this.existingShapes.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  this.existingShapes.forEach(shape => {
    const strokeW = 'strokeWidth' in shape ? (shape as any).strokeWidth : 1;
    const padding = (strokeW || 1) * 2 + 20;
    if (shape.type === 'free-draw' && shape.points) {
      shape.points.forEach(p => {
        minX = Math.min(minX, p.x - padding);
        minY = Math.min(minY, p.y - padding);
        maxX = Math.max(maxX, p.x + padding);
        maxY = Math.max(maxY, p.y + padding);
      });
    } else {
      const s = shape as any;
      if (s.x === undefined || s.y === undefined) return;

      const x1 = s.x;
      const y1 = s.y;
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
  });

  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) return;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;

  // Save old state
  const oldCanvas = this.canvas;
  const oldCtx = this.ctx;
  const oldRoughCanvas = this.roughCanvas;
  const oldPanX = this.panX;
  const oldPanY = this.panY;
  const oldScale = this.scale;
  const oldSelection = [...this.SelectionController.getSelectedShapes()];

  // Remove selection briefly so it's not exported
  this.SelectionController.setSelectedShapes([]);

  // Swap state
  this.canvas = tempCanvas;
  this.ctx = tempCtx;
  this.roughCanvas = rough.canvas(tempCanvas);
  this.panX = -minX;
  this.panY = -minY;
  this.scale = 1;

  // Render
  this.clearCanvas();

  // Export
  const dataUrl = tempCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `collabydraw-export-${new Date().getTime()}.png`;
  link.href = dataUrl;
  link.click();

  // Restore state
  this.canvas = oldCanvas;
  this.ctx = oldCtx;
  this.roughCanvas = oldRoughCanvas;
  this.panX = oldPanX;
  this.panY = oldPanY;
  this.scale = oldScale;
  this.SelectionController.setSelectedShapes(oldSelection);

  // re-render the actual canvas
  this.clearCanvas();
}

  public undo() {
    this.yUndoManager.undo();
    this.rebuildFromYjs();
  }

  public redo() {
    this.yUndoManager.redo();
    this.rebuildFromYjs();
  }

  private rebuildFromYjs() {
    this.existingShapes = this.yOrder.toArray().map(id => this.yShapes.get(id)).filter(Boolean) as Shape[];
    this.spatialIndex.updateIndex(this.existingShapes);
    this.clearCanvas();
    this.notifyShapeCountChange();
    this.onHistoryChange?.(
      this.yUndoManager.undoStack.length > 0,
      this.yUndoManager.redoStack.length > 0
    );
  }

  /** Sync GroupManager descriptors from Yjs (called on yGroups.observe) */
  private rebuildGroupDescriptors() {
    this.yGroups.forEach((descriptor, groupId) => {
      this.groupManager.setDescriptor(descriptor);
    });
    // Remove any locally cached descriptors no longer in Yjs
    this.groupManager.allDescriptors().forEach(desc => {
      if (!this.yGroups.has(desc.groupId)) {
        this.groupManager.removeDescriptor(desc.groupId);
      }
    });
  }

  /**
   * Phase 3: Apply a group rotation via GroupManager.
   * Wraps all mutations in a single Yjs transaction for CRDT safety.
   */
  public rotateGroup(groupId: string, deltaAngle: number) {
    const members = this.groupManager.getMembersOf(groupId, this.existingShapes);
    if (members.length === 0) return;
    this.groupManager.applyGroupRotation(groupId, this.existingShapes, deltaAngle);
    this.yDoc.transact(() => {
      members.forEach(shape => {
        if (shape.id) this.yShapes.set(shape.id, shape);
      });
      const desc = this.groupManager.getDescriptor(groupId);
      if (desc) this.yGroups.set(groupId, desc);
    }, this.connectionId || "local");
  }

  // ─────────────────────────────────────────────
  // Phase 5: Command-pattern undo/redo
  // ─────────────────────────────────────────────

  /** Execute a typed Command through the CommandManager (tracked for undo/redo) */
  public executeCommand(cmd: import("./CommandManager").Command) {
    this.commandManager.execute(cmd);
  }

  public get commandUndoLabel() { return this.commandManager.undoLabel; }
  public get commandRedoLabel() { return this.commandManager.redoLabel; }

  // ─────────────────────────────────────────────
  // Phase 6: Layer management public API
  // ─────────────────────────────────────────────

  /**
   * Phase 6: Persistence & Recovery
   * Returns the entire document state as a Uint8Array (Yjs binary format)
   */
  public getEncodedState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.yDoc);
  }

  /**
   * Applies a binary state update to the current document.
   * Used for restoring from local storage or snapshots.
   */
  public applyEncodedState(update: Uint8Array) {
    if (!update || update.length === 0) return;
    try {
      Y.applyUpdate(this.yDoc, update, "recovery");
      this.rebuildFromYjs();
      this.rebuildGroupDescriptors();
      this.clearCanvas();
    } catch (e) {
      console.error("Critical error applying Yjs update. The binary state might be corrupt.", e);
    }
  }

  public getLayers() { return this.layerManager.getLayers(); }
  public createLayer(name: string) { return this.layerManager.createLayer(name); }
  public renameLayer(id: string, name: string) { this.layerManager.renameLayer(id, name); }
  public toggleLayerVisibility(id: string) { this.layerManager.toggleVisibility(id); this.clearCanvas(); }
  public toggleLayerLock(id: string) { this.layerManager.toggleLock(id); }
  public reorderLayers(layerIds: string[]) { this.layerManager.reorderLayers(layerIds); this.clearCanvas(); }
  public deleteLayer(id: string) {
    this.layerManager.deleteLayer(id, this.existingShapes, (shape) => {
      if (shape.id) this.yShapes.set(shape.id, shape);
    });
  }
  public moveShapeToLayer(shapeId: string, layerId: string) {
    const shape = this.existingShapes.find((s: Shape) => s.id === shapeId);
    if (!shape) return;
    this.layerManager.moveShapeToLayer(shape, layerId, (s: Shape) => {
      if (s.id) this.yShapes.set(s.id, s);
    });
  }
  public setLayerChangeCallback(cb: (layers: import("./LayerManager").Layer[]) => void) {
    this.layerManager.onChange = cb;
  }
  private _addShapeToCRDT(shape: Shape) {
    this.yDoc.transact(() => {
      if (shape.id) {
        this.yShapes.set(shape.id, shape);
        if (!this.yOrder.toArray().includes(shape.id)) {
          this.yOrder.push([shape.id]);
        }
      }
    }, this.connectionId || "local");
  }

  private _removeShapeFromCRDT(shapeId: string) {
    this.yDoc.transact(() => {
      this.yShapes.delete(shapeId);
      const arr = this.yOrder.toArray();
      const idx = arr.indexOf(shapeId);
      if (idx !== -1) {
        this.yOrder.delete(idx, 1);
      }
    }, this.connectionId || "local");
  }

  private _updateShapeInCRDT(shape: Shape) {
    this.yDoc.transact(() => {
      if (shape.id) {
        this.yShapes.set(shape.id, shape);
      }
    }, this.connectionId || "local");
  }

  private _clearAllCRDT() {
    this.yDoc.transact(() => {
      this.yShapes.clear();
      this.yOrder.delete(0, this.yOrder.length);
    }, this.connectionId || "local");
  }

  private _setShapesCRDT(shapes: Shape[]) {
    this.yDoc.transact(() => {
      this.yShapes.clear();
      this.yOrder.delete(0, this.yOrder.length);
      shapes.forEach(shape => {
        if (shape.id) {
          this.yShapes.set(shape.id, shape);
          this.yOrder.push([shape.id]);
        }
      });
    }, this.connectionId || "local");
  }
}

