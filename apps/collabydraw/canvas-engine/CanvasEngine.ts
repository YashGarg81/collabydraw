import {
  FillStyle,
  FONT_SIZE_MAP,
  FontFamily,
  FontSize,
  FontStyle,
  LOCALSTORAGE_CANVAS_KEY,
  RoughStyle,
  Shape,
  StrokeEdge,
  StrokeStyle,
  StrokeWidth,
  TextAlign,
  ToolType,
} from "@/types/canvas";
import { SelectionController } from "./SelectionController";
import { v4 as uuidv4 } from "uuid";
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

  private existingShapes: Shape[];
  private isMarqueeSelecting: boolean = false;
  private marqueeStartX: number = 0;
  private marqueeStartY: number = 0;
  private marqueeCurrentX: number = 0;
  private marqueeCurrentY: number = 0;
  private undoStack: Shape[][] = [];
  private redoStack: Shape[][] = [];
  private SelectionController: SelectionController;
  public isSnapToGrid: boolean = false;

  public setSnapToGrid(snap: boolean) {
    this.isSnapToGrid = snap;
    this.SelectionController.isSnapToGrid = snap;
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

  private connectionId: string | null = null;
  private myConnections: WebSocketConnection[] = [];

  private streamingShapeId: string | null = null;
  private streamingThrottleTimeout: number | null = null;
  private streamingUpdateInterval: number = 50;
  private remoteStreamingShapes: Map<string, Shape> = new Map();

  private cursorThrottleTimeout: number | null = null;
  private remoteCursors: Map<
    string,
    { x: number; y: number; userId: string; userName: string }
  > = new Map();
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
    this.ctx = canvas.getContext("2d")!;
    this.roughCanvas = rough.canvas(canvas);
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

    this.encryptionKey = encryptionKey;

    this.clicked = false;
    this.existingShapes = [];

    this.canvas.width = document.body.clientWidth;
    this.canvas.height = document.body.clientHeight;

    this.currentTheme = appTheme;

    this.init();
    this.initMouseHandler();

    this.SelectionController.setOnUpdate(() => {
      if (this.isStandalone) {
        localStorage.setItem(
          LOCALSTORAGE_CANVAS_KEY,
          JSON.stringify(this.existingShapes)
        );
      }
    });
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
      // console.log("✅Connecting to WebSocket…");
      this.connectWebSocket();
      // console.log("✅Connected to WebSocket…");
    }
  }

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
                (c) => c.connectionId !== data.connectionId
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
              this.remoteCursors.set(key, {
                x: coords.x,
                y: coords.y,
                userId: data.userId,
                userName: data.userName ?? data.userId,
              });
              
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
      console.warn("WebSocket closed:", e);
      setTimeout(() => this.connectWebSocket(), 2000);
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
    if (this.isStandalone) {
      try {
        const storedShapes = localStorage.getItem(LOCALSTORAGE_CANVAS_KEY);
        if (storedShapes) {
          const parsedShapes = JSON.parse(storedShapes);
          this.existingShapes = [...this.existingShapes, ...parsedShapes];
        }
      } catch (e) {
        console.error("Error loading shapes from localStorage:", e);
      }
    }
    this.clearCanvas();
  }

  initMouseHandler() {
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
    this.ctx.fillStyle = color;
    this.clearCanvas();
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
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.panX, this.panY);
    this.ctx.clearRect(
      -this.panX / this.scale,
      -this.panY / this.scale,
      this.canvas.width / this.scale,
      this.canvas.height / this.scale
    );
    this.ctx.fillStyle = this.canvasBgColor;
    this.ctx.fillRect(
      -this.panX / this.scale,
      -this.panY / this.scale,
      this.canvas.width / this.scale,
      this.canvas.height / this.scale
    );

    this.existingShapes.map((shape: Shape) => {
      const isBeingStreamed = [...this.remoteStreamingShapes.values()].some(
        (streamingShape) => streamingShape.id === shape.id
      );

      if (isBeingStreamed) {
        return;
      }
      if (shape.type === "rectangle") {
        this.drawRect(
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          shape.strokeWidth || DEFAULT_STROKE_WIDTH,
          shape.strokeFill || DEFAULT_STROKE_FILL,
          shape.bgFill || DEFAULT_BG_FILL,
          shape.rounded,
          shape.strokeStyle,
          shape.roughStyle,
          shape.fillStyle
        );
      } else if (shape.type === "ellipse") {
        this.drawEllipse(
          shape.x,
          shape.y,
          shape.radX,
          shape.radY,
          shape.strokeWidth || DEFAULT_STROKE_WIDTH,
          shape.strokeFill || DEFAULT_STROKE_FILL,
          shape.bgFill || DEFAULT_BG_FILL,
          shape.strokeStyle,
          shape.roughStyle,
          shape.fillStyle
        );
      } else if (shape.type === "diamond") {
        this.drawDiamond(
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          shape.strokeWidth || DEFAULT_STROKE_WIDTH,
          shape.strokeFill || DEFAULT_STROKE_FILL,
          shape.bgFill || DEFAULT_BG_FILL,
          shape.rounded,
          shape.strokeStyle,
          shape.roughStyle,
          shape.fillStyle
        );
      } else if (shape.type === "line") {
        this.drawLine(
          shape.x,
          shape.y,
          shape.toX,
          shape.toY,
          shape.strokeWidth || DEFAULT_STROKE_WIDTH,
          shape.strokeFill || DEFAULT_STROKE_FILL,
          shape.strokeStyle,
          shape.roughStyle,
          false
        );
      } else if (shape.type === "arrow") {
        this.drawLine(
          shape.x,
          shape.y,
          shape.toX,
          shape.toY,
          shape.strokeWidth || DEFAULT_STROKE_WIDTH,
          shape.strokeFill || DEFAULT_STROKE_FILL,
          shape.strokeStyle,
          shape.roughStyle,
          true
        );
      } else if (shape.type === "free-draw") {
        this.drawFreeDraw(
          shape.points,
          shape.strokeFill,
          shape.bgFill,
          shape.strokeStyle,
          shape.fillStyle,
          shape.strokeWidth
        );
      } else if (shape.type === "text") {
        this.drawText(
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          shape.text,
          shape.strokeFill,
          shape.fontStyle,
          shape.fontFamily,
          shape.fontSize,
          shape.textAlign
        );
      } else if (shape.type === "sticky") {
        this.drawRect(
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          2, // subtle stroke
          shape.strokeFill,
          shape.bgFill,
          shape.rounded,
          shape.strokeStyle,
          shape.roughStyle,
          "solid"
        );
        this.drawText(
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          shape.text,
          shape.strokeFill,
          shape.fontStyle,
          shape.fontFamily,
          shape.fontSize,
          shape.textAlign
        );
      } else if (shape.type === "image") {
        this.drawImageShape(shape);
      } else if (shape.type === "frame") {
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
      } else if (shape.type === "embed") {
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
        this.ctx.fillText(
          shape.url,
          shape.x + shape.width / 2,
          shape.y + shape.height / 2
        );
        this.ctx.restore();
      }
    });

    if (this.activeTextarea && this.activeTextPosition) {
      const { x, y } = this.activeTextPosition;
      this.activeTextarea.style.transform = `translate(${x * this.scale + this.panX}px, ${y * this.scale + this.panY}px)`;
    }

    this.remoteStreamingShapes.forEach((shape) => {
      if (shape.type === "rectangle") {
        this.drawRect(
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          shape.strokeWidth || DEFAULT_STROKE_WIDTH,
          shape.strokeFill || DEFAULT_STROKE_FILL,
          shape.bgFill || DEFAULT_BG_FILL,
          shape.rounded,
          shape.strokeStyle,
          shape.roughStyle,
          shape.fillStyle
        );
    } else if (shape.type === "ellipse") {
      this.drawEllipse(
        shape.x,
        shape.y,
        shape.radX,
        shape.radY,
        shape.strokeWidth || DEFAULT_STROKE_WIDTH,
        shape.strokeFill || DEFAULT_STROKE_FILL,
        shape.bgFill || DEFAULT_BG_FILL,
        shape.strokeStyle,
        shape.roughStyle,
        shape.fillStyle
      );
    } else if (shape.type === "diamond") {
      this.drawDiamond(
        shape.x,
        shape.y,
        shape.width,
        shape.height,
        shape.strokeWidth || DEFAULT_STROKE_WIDTH,
        shape.strokeFill || DEFAULT_STROKE_FILL,
        shape.bgFill || DEFAULT_BG_FILL,
        shape.rounded,
        shape.strokeStyle,
        shape.roughStyle,
        shape.fillStyle
      );
    } else if (shape.type === "line" || shape.type === "arrow") {
      this.drawLine(
        shape.x,
        shape.y,
        shape.toX,
        shape.toY,
        shape.strokeWidth || DEFAULT_STROKE_WIDTH,
        shape.strokeFill || DEFAULT_STROKE_FILL,
        shape.strokeStyle,
        shape.roughStyle,
        shape.type === "arrow"
      );
    } else if (shape.type === "free-draw") {
      this.drawFreeDraw(
        shape.points,
        shape.strokeFill,
        shape.bgFill,
        shape.strokeStyle,
        shape.fillStyle,
        shape.strokeWidth
      );
    } else if (shape.type === "text") {
      this.drawText(
        shape.x,
        shape.y,
        shape.width,
        shape.height,
        shape.text,
        shape.strokeFill,
        shape.fontStyle,
        shape.fontFamily,
        shape.fontSize,
        shape.textAlign
      );
    } else if (shape.type === "image") {
      this.drawImageShape(shape);
    } else if (shape.type === "frame") {
      this.ctx.save();
      this.ctx.strokeStyle = "#a5a5a5";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      
      this.ctx.fillStyle = "#a5a5a5";
      this.ctx.font = "14px sans-serif";
      this.ctx.textBaseline = "bottom";
      this.ctx.fillText(shape.frameName, shape.x, shape.y - 4);
      this.ctx.restore();
    } else if (shape.type === "embed") {
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
      this.ctx.fillText("Web Embed", shape.x + shape.width / 2, shape.y + shape.height / 2);
      this.ctx.restore();
    }
  });

  if(
    this.SelectionController.hasSelection() &&
      this.activeTool === "selection"
    ) {
    this.SelectionController.drawSelectionBox();
}

if (this.activeTool === "selection" && this.isMarqueeSelecting) {
    this.ctx.save();
    this.ctx.fillStyle = "rgba(105, 101, 219, 0.08)";
    this.ctx.strokeStyle = "#6965db";
    this.ctx.lineWidth = 1;
    
    const minX = Math.min(this.marqueeStartX, this.marqueeCurrentX);
    const minY = Math.min(this.marqueeStartY, this.marqueeCurrentY);
    const width = Math.abs(this.marqueeCurrentX - this.marqueeStartX);
    const height = Math.abs(this.marqueeCurrentY - this.marqueeStartY);
    
    this.ctx.beginPath();
    this.ctx.rect(minX, minY, width, height);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
}

if (this.activeTool === "lasso" && this.isLassoSelecting && this.lassoPoints.length > 0) {
    this.ctx.save();
    this.ctx.fillStyle = "rgba(105, 101, 219, 0.08)";
    this.ctx.strokeStyle = "#6965db";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
    for (let i = 1; i < this.lassoPoints.length; i++) {
        this.ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
}

if (this.laserStrokes.length > 0) {
    const now = Date.now();
    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    
    this.laserStrokes.forEach(stroke => {
        if (stroke.points.length < 2) return;
        this.ctx.strokeStyle = stroke.strokeFill;
        
        for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i + 1];
            
            const age = now - p1.time;
            const opacity = Math.max(0, 1 - (age / 1500));
            
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.globalAlpha = opacity;
            this.ctx.lineWidth = 6 * opacity;
            this.ctx.stroke();
        }
    });
    this.ctx.restore();
}

this.remoteCursors.forEach((cursor, userConnKey) => {
  const { x, y, userId, userName } = cursor;
  const screenX = x * this.scale + this.panX;
  const screenY = y * this.scale + this.panY;

  const cursorColor: string = getClientColor({ userId, userName });
  const boxBackground = cursorColor;
  const boxTextColor = COLOR_CHARCOAL_BLACK;
  const pointerWidth = 12;
  const pointerHeight = 15;

  const lastClickTime = this.remoteClickIndicators.get(userConnKey);
  const showClickCircle =
    !!lastClickTime && Date.now() - lastClickTime < 800;

  if (showClickCircle) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, 14, 0, Math.PI * 2, false);
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    this.ctx.strokeStyle = "rgb(255 255 255 / 53%)";
    this.ctx.closePath();

    this.ctx.beginPath();
    this.ctx.arc(x, y, 14, 0, Math.PI * 2, false);
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.strokeStyle = cursorColor;
    this.ctx.closePath();
  }

  this.ctx.save();

  // Draw white background for the pointer
  this.ctx.fillStyle = COLOR_WHITE;
  this.ctx.strokeStyle = COLOR_WHITE;
  this.ctx.lineWidth = 6;
  this.ctx.lineJoin = "round";
  this.ctx.beginPath();
  this.ctx.moveTo(screenX, screenY);
  this.ctx.lineTo(screenX, screenY + 14);
  this.ctx.lineTo(screenX + 4, screenY + 9);
  this.ctx.lineTo(screenX + 11, screenY + 8);
  this.ctx.closePath();
  this.ctx.stroke();
  this.ctx.fill();

  // Draw actual pointer with color
  this.ctx.fillStyle = cursorColor;
  this.ctx.strokeStyle = cursorColor;
  this.ctx.lineWidth = 2;
  this.ctx.beginPath();
  this.ctx.moveTo(screenX, screenY);
  this.ctx.lineTo(screenX, screenY + 14);
  this.ctx.lineTo(screenX + 4, screenY + 9);
  this.ctx.lineTo(screenX + 11, screenY + 8);
  this.ctx.closePath();
  this.ctx.fill();
  this.ctx.stroke();

  const offsetX = screenX + pointerWidth / 2;
  const offsetY = screenY + pointerHeight + 2;
  const paddingX = 5;
  const paddingY = 3;

  this.ctx.font = "600 13px sans-serif";
  const textMetrics = this.ctx.measureText(userName);
  const textHeight =
    textMetrics.actualBoundingBoxAscent +
    textMetrics.actualBoundingBoxDescent;
  const boxHeight = Math.max(textHeight, 12) + paddingY * 2 + 2;
  const boxWidth = textMetrics.width + paddingX * 2 + 4;
  const boxX = offsetX - 1;
  const boxY = offsetY - 1;

  // Draw name label box
  if (this.ctx.roundRect) {
    this.ctx.beginPath();
    this.ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
    this.ctx.fillStyle = boxBackground;
    this.ctx.fill();
    this.ctx.strokeStyle = COLOR_WHITE;
    this.ctx.stroke();

    // Highlight stroke for speaker // Option 2 for showing active indicator
    // this.ctx.beginPath();
    // this.ctx.roundRect(boxX - 2, boxY - 2, boxWidth + 4, boxHeight + 4, 8);
    // this.ctx.strokeStyle = labelStrokeColor;
    // this.ctx.stroke();
  } else {
    roundRect(this.ctx, boxX, boxY, boxWidth, boxHeight, 8, COLOR_WHITE);
  }

  // Draw username text
  this.ctx.fillStyle = boxTextColor;
  this.ctx.fillText(
    userName,
    offsetX + paddingX + 1,
    offsetY + paddingY + textMetrics.actualBoundingBoxAscent
  );

  this.ctx.restore();
});

this.remoteClickIndicators.forEach((timestamp, key) => {
  if (Date.now() - timestamp > 1000) {
    this.remoteClickIndicators.delete(key);
  }
});

this.triggerViewChange();
  }

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
  const { x, y } = this.transformPanScale(e.clientX, e.clientY);
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

      if (this.SelectionController.isPointInShape(x, y, shape)) {
        found = true;
        const groupMembers = shape.groupId ? this.existingShapes.filter(s => s.groupId === shape.groupId) : [shape];
        
        if (e.shiftKey) {
            const isSelected = this.SelectionController.getSelectedShapes().find(s => s.id === shape.id);
            if (isSelected) {
                const newSelection = this.SelectionController.getSelectedShapes().filter(s => !groupMembers.find(g => g.id === s.id));
                this.SelectionController.setSelectedShapes(newSelection);
            } else {
                this.SelectionController.setSelectedShapes([...this.SelectionController.getSelectedShapes(), ...groupMembers]);
            }
        } else if (!this.SelectionController.getSelectedShapes().find(s => s.id === shape.id)) {
            this.SelectionController.setSelectedShapes(groupMembers);
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

  this.clicked = true;
  this.startX = this.isSnapToGrid ? Math.round(x / 20) * 20 : x;
  this.startY = this.isSnapToGrid ? Math.round(y / 20) * 20 : y;

  if (this.activeTool === "free-draw") {
    this.existingShapes.push({
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
  } else if (this.activeTool === "grab") {
    this.startX = e.clientX;
    this.startY = e.clientY;
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
                this.existingShapes[index] = selectedShape;
                if (this.isStandalone) {
                  localStorage.setItem(
                    LOCALSTORAGE_CANVAS_KEY,
                    JSON.stringify(this.existingShapes)
                  );
                } else if (this.sendMessage && this.roomId) {
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

  if (this.SelectionController.hasSelection()) {
    localStorage.setItem(
      LOCALSTORAGE_CANVAS_KEY,
      JSON.stringify(this.existingShapes)
    );
  }

  const { x, y } = this.transformPanScale(e.clientX, e.clientY);

  const snappedX = this.isSnapToGrid ? Math.round(x / 20) * 20 : x;
  const snappedY = this.isSnapToGrid ? Math.round(y / 20) * 20 : y;

  const width = snappedX - this.startX;
  const height = snappedY - this.startY;

  const isClick = Math.abs(width) > 5 && Math.abs(height) > 5;

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
    this.existingShapes.push(shape);
    this.notifyShapeCountChange();

    if (this.isStandalone) {
      try {
        localStorage.setItem(
          LOCALSTORAGE_CANVAS_KEY,
          JSON.stringify(this.existingShapes)
        );
      } catch (e) {
        console.error("Error saving shapes to localStorage:", e);
      }
    } else if (this.sendMessage && this.roomId) {
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

        const payload: any = { x: coords.x, y: coords.y };
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

      case "grab":
        const { x: transformedX, y: transformedY } = this.transformPanScale(
          e.clientX,
          e.clientY
        );
        const { x: startTransformedX, y: startTransformedY } =
          this.transformPanScale(this.startX, this.startY);

        const deltaX = transformedX - startTransformedX;
        const deltaY = transformedY - startTransformedY;

        this.panX += deltaX * this.scale;
        this.panY += deltaY * this.scale;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.clearCanvas();
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

  textarea.addEventListener("input", () => {
    hasUnsavedChanges = true;
    resizeTextarea();
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      hasUnsavedChanges = true;
      resizeTextarea();
    }
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
    this.existingShapes.push(newShape);
    this.notifyShapeCountChange();

    if (this.isStandalone) {
      localStorage.setItem(
        LOCALSTORAGE_CANVAS_KEY,
        JSON.stringify(this.existingShapes)
      );
    } else if (this.sendMessage && this.roomId) {
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
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
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
  this.existingShapes.push(tempShape);
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
        this.existingShapes.splice(index, 1);
        this.notifyShapeCountChange();
      } else {
        this.existingShapes[index] = {
          ...tempShape,
          text
        } as Shape;
      }
    }

    this.activeTextarea = null;
    this.activeTextPosition = null;

    if (this.isStandalone) {
      localStorage.setItem(LOCALSTORAGE_CANVAS_KEY, JSON.stringify(this.existingShapes));
    } else if (this.sendMessage && this.roomId && text && index !== -1) {
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
      this.existingShapes.push(shape);
      this.notifyShapeCountChange();

      if (this.isStandalone) {
        localStorage.setItem(LOCALSTORAGE_CANVAS_KEY, JSON.stringify(this.existingShapes));
      } else if (this.sendMessage && this.roomId) {
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
      const endX = shape.x + shape.width;
      const startY = shape.y;
      const textHeight = FONT_SIZE_MAP[shape.fontSize];
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
    this.existingShapes.splice(shapeIndex, 1);
    this.notifyShapeCountChange();
    this.clearCanvas();

    if (this.isStandalone) {
      try {
        localStorage.setItem(
          LOCALSTORAGE_CANVAS_KEY,
          JSON.stringify(this.existingShapes)
        );
      } catch (e) {
        console.error("Error saving shapes to localStorage:", e);
      }
    } else if (this.sendMessage && this.roomId) {
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

destroy() {
  this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
  this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
  this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
  this.canvas.removeEventListener("wheel", this.mouseWheelHandler);
  this.canvas.removeEventListener("touchstart", this.touchStartHandler);
  this.canvas.removeEventListener("touchmove", this.touchMoveHandler);
  this.canvas.removeEventListener("touchend", this.touchEndHandler);

  if (this.socket?.readyState === WebSocket.OPEN) {
    this.socket.send(
      JSON.stringify({
        type: WsDataType.LEAVE,
        roomId: this.roomId,
      })
    );
  }
  this.socket?.close();
  this.socket = null;

  if (this.flushInterval) clearInterval(this.flushInterval);
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
  this.existingShapes = [];
  this.notifyShapeCountChange();
  this.clearCanvas();
  if (this.isStandalone) {
    localStorage.removeItem(LOCALSTORAGE_CANVAS_KEY);
  }
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
  if(index !== -1) {
  this.existingShapes[index] = updatedShape;
  this.clearCanvas();
}
  }

  public updateShapes(shapes: Shape[]): void {
  shapes.forEach((shape) => {
    const index = this.existingShapes.findIndex((s) => s.id === shape.id);
    if (index === -1) {
      this.existingShapes.push(shape);
    } else {
      this.existingShapes[index] = shape;
      const selectedShapes = this.SelectionController.getSelectedShapes();
      const selIndex = selectedShapes.findIndex(s => s.id === shape.id);
      if (selIndex !== -1) {
          const newSelection = [...selectedShapes];
          newSelection[selIndex] = shape;
          this.SelectionController.setSelectedShapes(newSelection);
      }
    }
  });
  this.clearCanvas();
}

  public removeShape(id: string): void {
  this.existingShapes = this.existingShapes.filter(
    (shape) => shape.id !== id
  );
  this.clearCanvas();
}

  private notifyShapeCountChange() {
  this.onShapeCountChange?.(this.existingShapes.length);
}

  public setTheme(newTheme: "light" | "dark") {
  this.currentTheme = newTheme;
  this.clearCanvas();
}

  private handleKeyDown = (e: KeyboardEvent) => {
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
    
      this.existingShapes.push(clonedShape);
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
  const indices = selectedShapes.map(s => this.existingShapes.findIndex(e => e.id === s.id)).filter(i => i !== -1).sort((a, b) => a - b);
  
  indices.forEach(index => {
      if (index > 0) {
        const temp = this.existingShapes[index - 1];
        this.existingShapes[index - 1] = this.existingShapes[index];
        this.existingShapes[index] = temp;
      }
  });
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
          const [shape] = this.existingShapes.splice(index, 1);
          shapesToMove.push(shape);
      }
  });
  
  // unshift them backwards so their relative order is preserved, wait unshifting in order reverses them. Let's unshift backwards
  shapesToMove.reverse().forEach(shape => {
      this.existingShapes.unshift(shape);
  });
  
  this.clearCanvas();
  this.syncAllShapes();
}

public bringForward() {
  const selectedShapes = this.SelectionController.getSelectedShapes();
  if (selectedShapes.length === 0) return;
  this.saveState();
  
  // Process from back to front
  const indices = selectedShapes.map(s => this.existingShapes.findIndex(e => e.id === s.id)).filter(i => i !== -1).sort((a, b) => b - a);
  
  indices.forEach(index => {
      if (index < this.existingShapes.length - 1) {
        const temp = this.existingShapes[index + 1];
        this.existingShapes[index + 1] = this.existingShapes[index];
        this.existingShapes[index] = temp;
      }
  });
  
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
          const [shape] = this.existingShapes.splice(index, 1);
          shapesToMove.push(shape);
      }
  });
  
  shapesToMove.forEach(shape => {
      this.existingShapes.push(shape);
  });
  
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

  if (this.isStandalone) {
    try {
      localStorage.setItem(
        LOCALSTORAGE_CANVAS_KEY,
        JSON.stringify(this.existingShapes)
      );
    } catch (e) {
      console.error("Error saving shapes to localStorage:", e);
    }
  }
  
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
    
    this.saveState();
    const groupId = Math.random().toString(36).substring(2, 15);
    selectedShapes.forEach(shape => {
        shape.groupId = groupId;
    });
    this.syncAllShapes();
}

public ungroupSelected() {
    const selectedShapes = this.SelectionController.getSelectedShapes();
    if (selectedShapes.length === 0) return;
    
    if (!selectedShapes.some(s => s.groupId)) return;
    
    this.saveState();
    selectedShapes.forEach(shape => {
        delete shape.groupId;
    });
    this.syncAllShapes();
}

  private saveState() {
  this.undoStack.push(JSON.parse(JSON.stringify(this.existingShapes)));
  this.redoStack = [];
  if (this.undoStack.length > 50) {
    this.undoStack.shift();
  }
}

  public undo() {
  if (this.undoStack.length === 0) return;
  this.redoStack.push(JSON.parse(JSON.stringify(this.existingShapes)));
  this.existingShapes = this.undoStack.pop()!;
  this.SelectionController.setSelectedShapes([]);
  this.notifyShapeCountChange();
  this.clearCanvas();
  this.syncAllShapes();
}

  public redo() {
  if (this.redoStack.length === 0) return;
  this.undoStack.push(JSON.parse(JSON.stringify(this.existingShapes)));
  this.existingShapes = this.redoStack.pop()!;
  this.SelectionController.setSelectedShapes([]);
  this.notifyShapeCountChange();
  this.clearCanvas();
  this.syncAllShapes();
}

  // Wave 8: Bulk-add shapes (AI / Mermaid). The entire batch is a single undo step.
  public addShapes(shapes: Shape[]) {
    if (!shapes || shapes.length === 0) return;
    // Save current state as one undo snapshot
    this.undoStack.push(JSON.parse(JSON.stringify(this.existingShapes)));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];

    this.existingShapes = [...this.existingShapes, ...shapes];
    this.notifyShapeCountChange();
    this.clearCanvas();
    this.syncAllShapes();
  }

  private syncAllShapes() {
  if (this.isStandalone) {
    try {
      localStorage.setItem(
        LOCALSTORAGE_CANVAS_KEY,
        JSON.stringify(this.existingShapes)
      );
    } catch (e) {
      console.error("Error saving shapes to localStorage:", e);
    }
  } else if (this.sendMessage && this.roomId) {
    // For collaborative rooms, an undo/redo might mean multiple shapes changed.
    // To keep it simple without full CRDTs, we broadcast an update for ALL shapes
    // in the new state, and maybe delete shapes that were removed.
    // This is a naive approach: we broadcast the entire existingShapes array.
    // A better way is to loop through and broadcast each.
    this.existingShapes.forEach((shape) => {
      try {
        this.sendMessage?.(
          JSON.stringify({
            type: WsDataType.UPDATE,
            id: shape.id,
            message: shape,
            roomId: this.roomId,
          })
        );
      } catch (e) {
        console.error("Error sending shape update ws message", e);
      }
    });
    // We also need to tell others to erase shapes that are no longer here.
    // But we don't know which ones were deleted unless we diff.
    // Given the complexity, this is a basic first pass.
  }
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
}
