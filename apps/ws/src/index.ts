/**
 * Phase 3B: WebSocket Server with Redis Pub/Sub
 *
 * Architecture:
 *   - Each WS instance subscribes to Redis channels for rooms it hosts connections in
 *   - Outgoing messages are PUBLISHED to Redis ("room:{id}"), not broadcast in-memory
 *   - Redis fan-out delivers to all WS instances → they forward to their local clients
 *   - Room shape state is stored in Redis Hash ("shapes:{roomId}") for instant replay on JOIN
 *   - Gracefully falls back to in-memory broadcast if Redis is unavailable
 */

import dotenv from "dotenv";
dotenv.config();
import client from "@repo/db/client";
import { WebSocketMessage, WsDataType } from "@repo/common/types";
import { WebSocketServer, WebSocket } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import Redis from "ioredis";
import { canAccessBoard, SessionUser } from "@repo/db/client";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is ABSOLUTELY REQUIRED and not set");
}
const JWT_SECRET = process.env.JWT_SECRET;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ── Redis clients ─────────────────────────────────────────────────────────────
// Separate clients required: a subscribed client cannot issue non-subscribe commands
let pub: Redis | null = null;
let sub: Redis | null = null;
let redisAvailable = false;

function createRedisClient(name: string): Redis {
  const r = new Redis(REDIS_URL, {
    lazyConnect: true,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });
  r.on("connect", () => { console.log(`✅ Redis ${name} connected`); redisAvailable = true; });
  r.on("error",   (e) => { console.warn(`⚠️  Redis ${name} error (falling back to in-memory):`, e.message); redisAvailable = false; });
  return r;
}

async function initRedis() {
  try {
    pub = createRedisClient("pub");
    sub = createRedisClient("sub");
    await pub.connect();
    await sub.connect();
    redisAvailable = true;
  } catch (e) {
    console.warn("Redis not available — running in single-node in-memory mode:", e);
    redisAvailable = false;
  }
}

// ── In-memory state ───────────────────────────────────────────────────────────
type Connection = {
  connectionId: string;
  userId: string;
  user: SessionUser;
  userName: string;
  ws: WebSocket;
  rooms: Set<string>;
};

const connections = new Map<string, Connection>();
// Fallback in-memory shape store (used when Redis is down)
const memShapes: Record<string, WebSocketMessage[]> = {};
// Track which Redis channels this server instance is subscribed to
const subscribedChannels = new Set<string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function channelFor(roomId: string) { return `room:${roomId}`; }
function shapesKeyFor(roomId: string) { return `shapes:${roomId}`; }

function authUser(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionUser;
    if (!decoded.id || decoded.isBanned) return null;
    return decoded;
  } catch {
    return null;
  }
}

function generateConnectionId() {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getCurrentParticipants(roomId: string) {
  const map = new Map<string, { userId: string; userName: string }>();
  for (const conn of connections.values()) {
    if (conn.rooms.has(roomId)) {
      map.set(conn.userId, { userId: conn.userId, userName: conn.userName });
    }
  }
  return Array.from(map.values());
}

// ── Shape persistence helpers ─────────────────────────────────────────────────

async function getShapes(roomId: string): Promise<WebSocketMessage[]> {
  if (redisAvailable && pub) {
    try {
      const hash = await pub.hgetall(shapesKeyFor(roomId));
      return Object.values(hash || {}).map(v => JSON.parse(v));
    } catch { /* fall through */ }
  }
  return memShapes[roomId] || [];
}

async function upsertShape(roomId: string, shape: WebSocketMessage) {
  if (!shape.id) return;
  if (redisAvailable && pub) {
    try {
      await pub.hset(shapesKeyFor(roomId), shape.id, JSON.stringify(shape));
      return;
    } catch { /* fall through */ }
  }
  if (!memShapes[roomId]) memShapes[roomId] = [];
  const idx = memShapes[roomId].findIndex(s => s.id === shape.id);
  if (idx !== -1) memShapes[roomId][idx] = shape;
  else memShapes[roomId].push(shape);
}

async function deleteShape(roomId: string, shapeId: string) {
  if (redisAvailable && pub) {
    try { await pub.hdel(shapesKeyFor(roomId), shapeId); return; } catch { /* fall through */ }
  }
  if (memShapes[roomId]) {
    memShapes[roomId] = memShapes[roomId].filter(s => s.id !== shapeId);
  }
}

async function clearRoomShapes(roomId: string) {
  if (redisAvailable && pub) {
    try { await pub.del(shapesKeyFor(roomId)); return; } catch { /* fall through */ }
  }
  delete memShapes[roomId];
}

// ── Broadcast via Redis (or in-memory fallback) ───────────────────────────────

async function broadcast(
  roomId: string,
  message: WebSocketMessage,
  excludeConnectionIds: string[] = [],
  includeParticipants = false
) {
  if (includeParticipants || message.type === WsDataType.USER_JOINED) {
    message.participants = getCurrentParticipants(roomId);
  }

  const payload = JSON.stringify({ message, excludeConnectionIds });

  if (redisAvailable && pub) {
    try {
      await pub.publish(channelFor(roomId), payload);
      return;
    } catch { /* fall through to in-memory */ }
  }

  // In-memory fallback
  deliverLocally(roomId, message, excludeConnectionIds);
}

function deliverLocally(
  roomId: string,
  message: WebSocketMessage,
  excludeConnectionIds: string[] = []
) {
  for (const conn of connections.values()) {
    if (conn.rooms.has(roomId) && !excludeConnectionIds.includes(conn.connectionId)) {
      try {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(JSON.stringify(message));
        }
      } catch (e) {
        console.error(`Error sending to ${conn.connectionId}:`, e);
      }
    }
  }
}

// ── Redis subscription management ─────────────────────────────────────────────

async function ensureSubscribed(roomId: string) {
  if (!redisAvailable || !sub) return;
  const ch = channelFor(roomId);
  if (!subscribedChannels.has(ch)) {
    try {
      await sub.subscribe(ch);
      subscribedChannels.add(ch);
    } catch (e) {
      console.error("Redis subscribe error:", e);
    }
  }
}

async function maybeUnsubscribe(roomId: string) {
  if (!redisAvailable || !sub) return;
  // Only unsubscribe if no local connections are in this room
  const hasLocal = [...connections.values()].some(c => c.rooms.has(roomId));
  if (!hasLocal) {
    const ch = channelFor(roomId);
    try {
      await sub.unsubscribe(ch);
      subscribedChannels.delete(ch);
    } catch (e) {
      console.error("Redis unsubscribe error:", e);
    }
  }
}

// ── WebSocket server ──────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port: PORT });

wss.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.log(`⚠️  Port ${PORT} already in use — WS server already running. Skipping.`);
    process.exit(0); // exit 0 so concurrently doesn't treat it as failure
  } else {
    console.error("WebSocket server error:", err);
    process.exit(1);
  }
});


wss.on("connection", function connection(ws, req) {
  const url = req.url || "";
  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token");
  if (!token) { ws.close(1008, "User not authenticated"); return; }

  const user = authUser(token);
  if (!user) { ws.close(1008, "User not authenticated or banned"); return; }

  const connectionId = generateConnectionId();
  const conn: Connection = { connectionId, userId: user.id, user, userName: user.email, ws, rooms: new Set() };
  connections.set(connectionId, conn);

  ws.send(JSON.stringify({ type: WsDataType.CONNECTION_READY, connectionId }));
  console.log(`✅ CONNECTION_READY → ${connectionId}`);

  ws.on("error", (err) => console.error(`WS error ${connectionId}:`, err));

  ws.on("message", async (data) => {
    try {
      const msg: WebSocketMessage = JSON.parse(data.toString());
      if (!msg || !msg.roomId || !msg.userId) return;

      const connection = connections.get(connectionId);
      if (!connection) { ws.close(); return; }

      // Keep username up-to-date
      if (msg.userName && connection.userName !== msg.userName) {
        connection.userName = msg.userName;
      }

      switch (msg.type) {
        // ── JOIN ──────────────────────────────────────────────────────
        case WsDataType.JOIN: {
          const room = await client.room.findUnique({ where: { id: msg.roomId } });
          if (!room || !room.boardId) { ws.close(); return; }

          // Phase 3.5: Validate RBAC
          const hasAccess = await canAccessBoard(connection.user, room.boardId, "VIEWER");
          if (!hasAccess) {
            console.warn(`🚫 Access Denied for user ${connection.userId} to room ${msg.roomId}`);
            ws.send(JSON.stringify({ type: "ERROR", message: "Forbidden: No board access" }));
            return;
          }

          connection.rooms.add(msg.roomId);
          await ensureSubscribed(msg.roomId);

          const participants = getCurrentParticipants(msg.roomId);
          ws.send(JSON.stringify({
            type: WsDataType.USER_JOINED, roomId: msg.roomId,
            userId: connection.userId, userName: connection.userName,
            connectionId, participants, timestamp: new Date().toISOString(),
          }));

          // Send existing shapes
          const shapes = await getShapes(msg.roomId);
          if (shapes.length > 0) {
            ws.send(JSON.stringify({
              type: WsDataType.EXISTING_SHAPES, roomId: msg.roomId,
              message: shapes, timestamp: new Date().toISOString(),
            }));
          }

          // Broadcast join to others (first tab only)
          const isFirstTab = [...connections.values()]
            .filter(c => c.userId === userId && c.connectionId !== connectionId)
            .every(c => !c.rooms.has(msg.roomId));

          if (isFirstTab) {
            await broadcast(msg.roomId, {
              type: WsDataType.USER_JOINED, roomId: msg.roomId,
              userId: connection.userId, userName: connection.userName,
              connectionId, participants, timestamp: new Date().toISOString(),
              id: null, message: null,
            }, [connectionId], true);
          }
          break;
        }

        // ── LEAVE ─────────────────────────────────────────────────────
        case WsDataType.LEAVE: {
          connection.rooms.delete(msg.roomId);
          const hasOtherTabs = [...connections.values()]
            .some(c => c.userId === userId && c.connectionId !== connectionId && c.rooms.has(msg.roomId));

          if (!hasOtherTabs) {
            await broadcast(msg.roomId, {
              type: WsDataType.USER_LEFT, userId: connection.userId,
              userName: connection.userName, connectionId: connection.connectionId,
              roomId: msg.roomId, id: null, message: null, participants: null,
              timestamp: new Date().toISOString(),
            }, [connectionId], true);
          }
          await maybeUnsubscribe(msg.roomId);
          await maybeDeleteRoom(msg.roomId);
          break;
        }

        // ── CLOSE_ROOM ────────────────────────────────────────────────
        case WsDataType.CLOSE_ROOM: {
          const inRoom = [...connections.values()].filter(c => c.rooms.has(msg.roomId));
          if (inRoom.length === 1 && inRoom[0]?.connectionId === connectionId) {
            await deleteRoom(msg.roomId, inRoom);
          }
          break;
        }

        // ── CURSOR_MOVE ───────────────────────────────────────────────
        case WsDataType.CURSOR_MOVE:
          if (msg.connectionId && msg.message) {
            await broadcast(msg.roomId, {
              type: msg.type, roomId: msg.roomId,
              userId: connection.userId, userName: connection.userName,
              connectionId: connection.connectionId,
              message: msg.message, timestamp: new Date().toISOString(),
              id: null, participants: null,
            }, [msg.connectionId], false);
          }
          break;

        // ── STREAM_SHAPE / STREAM_UPDATE ──────────────────────────────
        case WsDataType.STREAM_SHAPE:
        case WsDataType.STREAM_UPDATE:
          await broadcast(msg.roomId, {
            type: msg.type, id: msg.id, message: msg.message,
            roomId: msg.roomId, userId: connection.userId,
            userName: connection.userName, connectionId: connection.connectionId,
            timestamp: new Date().toISOString(), participants: null,
          }, [connection.connectionId], false);
          break;

        // ── DRAW ──────────────────────────────────────────────────────
        case WsDataType.DRAW: {
          if (!msg.message || !msg.id) return;
          await upsertShape(msg.roomId, msg);
          await broadcast(msg.roomId, {
            type: msg.type, message: msg.message, id: msg.id,
            roomId: msg.roomId, userId: connection.userId,
            userName: connection.userName, connectionId: connection.connectionId,
            timestamp: new Date().toISOString(), participants: null,
          }, [], false);
          break;
        }

        // ── UPDATE ────────────────────────────────────────────────────
        case WsDataType.UPDATE: {
          if (!msg.message || !msg.id) return;
          await upsertShape(msg.roomId, msg);
          await broadcast(msg.roomId, {
            type: msg.type, id: msg.id, message: msg.message,
            roomId: msg.roomId, userId: connection.userId,
            userName: connection.userName, connectionId: connection.connectionId,
            participants: null, timestamp: new Date().toISOString(),
          }, [], false);
          break;
        }

        // ── YJS UPDATE ────────────────────────────────────────────────
        case WsDataType.YJS_UPDATE: {
          if (!msg.message) return;
          // We just broadcast Yjs updates to all peers.
          // State persistence would ideally store these updates, but for now
          // we rely on existingShapes or peer-to-peer sync.
          await broadcast(msg.roomId, {
            type: msg.type, message: msg.message, id: msg.id,
            roomId: msg.roomId, userId: connection.userId,
            userName: connection.userName, connectionId: connection.connectionId,
            participants: null, timestamp: new Date().toISOString(),
          }, [connection.connectionId], false);
          break;
        }

        // ── ERASER ────────────────────────────────────────────────────
        case WsDataType.ERASER: {
          if (!msg.id) return;
          await deleteShape(msg.roomId, msg.id);
          await broadcast(msg.roomId, {
            id: msg.id, type: msg.type, roomId: msg.roomId,
            userId: connection.userId, userName: connection.userName,
            connectionId: connection.connectionId,
            timestamp: new Date().toISOString(), message: null, participants: null,
          }, [], false);
          break;
        }

        default:
          console.warn(`Unknown type ${msg.type} from ${connectionId}`);
      }
    } catch (error) {
      console.error("Message processing error:", error);
    }
  });

  ws.on("close", async () => {
    const connection = connections.get(connectionId);
    if (connection) {
      for (const roomId of connection.rooms) {
        const hasOther = [...connections.values()]
          .some(c => c.userId === userId && c.connectionId !== connectionId && c.rooms.has(roomId));

        if (!hasOther) {
          await broadcast(roomId, {
            type: WsDataType.USER_LEFT, userId: connection.userId,
            userName: connection.userName, connectionId: connection.connectionId,
            roomId, id: null, message: null, participants: null,
            timestamp: new Date().toISOString(),
          }, [connectionId], true);
        }
        await maybeUnsubscribe(roomId);
        await maybeDeleteRoom(roomId);
      }
    }
    connections.delete(connectionId);
    console.log(`Connection ${connectionId} removed`);
  });
});

// ── Room cleanup helpers ───────────────────────────────────────────────────────

async function maybeDeleteRoom(roomId: string) {
  const anyConn = [...connections.values()].some(c => c.rooms.has(roomId));
  if (!anyConn) {
    try {
      await client.room.delete({ where: { id: roomId } });
      await clearRoomShapes(roomId);
      console.log(`Deleted empty room ${roomId}`);
    } catch { /* might already be deleted */ }
  }
}

async function deleteRoom(roomId: string, inRoom: Connection[]) {
  try {
    await client.room.delete({ where: { id: roomId } });
    await clearRoomShapes(roomId);
    for (const conn of inRoom) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({ type: "ROOM_CLOSED", roomId, timestamp: new Date().toISOString() }));
      }
      conn.rooms.delete(roomId);
    }
    console.log(`Room ${roomId} closed`);
  } catch (e) {
    console.error("Error deleting room:", e);
  }
}

// ── Wire up Redis subscriber message handler ──────────────────────────────────

function wireRedisSubscriber() {
  if (!sub) return;
  sub.on("message", (channel, rawPayload) => {
    try {
      const { message, excludeConnectionIds } = JSON.parse(rawPayload) as {
        message: WebSocketMessage;
        excludeConnectionIds: string[];
      };
      const roomId = channel.replace("room:", "");
      deliverLocally(roomId, message, excludeConnectionIds);
    } catch (e) {
      console.error("Redis subscriber parse error:", e);
    }
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

wss.on("listening", async () => {
  console.log(`WebSocket server started on port ${process.env.PORT || 8080}`);
  await initRedis();
  wireRedisSubscriber();
  if (redisAvailable) {
    console.log("🔴 Redis Pub/Sub enabled — horizontal scaling ready");
  } else {
    console.log("⚠️  Running without Redis — single-node in-memory mode");
  }
});
