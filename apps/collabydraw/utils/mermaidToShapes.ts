/**
 * Wave 8: Mermaid → CollabyDraw Shapes Parser
 *
 * Converts Mermaid flowchart and sequence diagram syntax into
 * native CollabyDraw Shape arrays without external layout engines.
 */

import { v4 as uuidv4 } from "uuid";
import { Shape, StrokeWidth, StrokeStyle, RoughStyle, FillStyle, StrokeEdge } from "@/types/canvas";

// ─── Layout constants ──────────────────────────────────────────────────────────

const NODE_W = 140;
const NODE_H = 60;
const COL_GAP = 200;  // horizontal gap between columns
const ROW_GAP = 120;  // vertical gap between rows
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

const DIAMOND_W = 160;
const DIAMOND_H = 80;
const ELLIPSE_RAD_X = 70;
const ELLIPSE_RAD_Y = 35;

const ACTOR_W = 120;
const ACTOR_H = 50;
const SEQ_COL_GAP = 200;
const SEQ_ROW_GAP = 80;
const SEQ_ORIGIN_X = 80;
const SEQ_ORIGIN_Y = 80;

// ─── Style defaults ────────────────────────────────────────────────────────────

const DEFAULT_STROKE: string = "rgba(255, 255, 255)";
const DEFAULT_BG: string = "rgba(18, 18, 18)";
const DEFAULT_SW: StrokeWidth = 1;
const DEFAULT_SS: StrokeStyle = "solid";
const DEFAULT_RS: RoughStyle = 1;
const DEFAULT_FS: FillStyle = "solid";
const DEFAULT_EDGE: StrokeEdge = "round";

// ─── Types ─────────────────────────────────────────────────────────────────────

type NodeType = "rect" | "diamond" | "ellipse" | "stadium";

interface FlowNode {
  id: string;
  label: string;
  nodeType: NodeType;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  arrowType: "arrow" | "line";
}

interface SeqActor {
  id: string;
  label: string;
}

interface SeqMessage {
  from: string;
  to: string;
  label: string;
  arrowType: "arrow" | "line";
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a Mermaid diagram string and return CollabyDraw shapes.
 * Supports: flowchart (graph TD / graph LR) and sequenceDiagram.
 */
export function mermaidToShapes(code: string): Shape[] {
  const trimmed = code.trim();

  if (/^sequenceDiagram/i.test(trimmed)) {
    return parseSequenceDiagram(trimmed);
  }

  if (/^(graph|flowchart)\s/i.test(trimmed)) {
    return parseFlowchart(trimmed);
  }

  throw new Error(
    "Unsupported Mermaid diagram type. Supported types: flowchart (graph TD/LR) and sequenceDiagram."
  );
}

// ─── Flowchart parser ──────────────────────────────────────────────────────────

function parseFlowchart(code: string): Shape[] {
  const lines = code.split("\n").map((l) => l.trim()).filter(Boolean);

  const headerLine = lines[0];
  const isLR = /^(graph|flowchart)\s+LR/i.test(headerLine);

  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  // Regex patterns for Mermaid node syntax
  const nodeLineRe = /([A-Za-z0-9_]+)\s*(\[.*?\]|\{.*?\}|\(.*?\)|>.*?<|\(\(.*?\)\)|\[\[.*?\]\])/g;
  const edgeRe = /([A-Za-z0-9_]+)\s*(-->|---|--)(\|.*?\|)?\s*([A-Za-z0-9_]+)/g;

  for (const line of lines.slice(1)) {
    // Parse edges first (they may include inline node definitions)
    let em: RegExpExecArray | null;
    edgeRe.lastIndex = 0;
    while ((em = edgeRe.exec(line)) !== null) {
      const [, fromId, connector, labelPart, toId] = em;
      const label = labelPart ? labelPart.replace(/\|/g, "").trim() : undefined;
      const arrowType: "arrow" | "line" = connector === "-->" ? "arrow" : "line";
      edges.push({ from: fromId, to: toId, label, arrowType });

      // Register bare nodes implicitly
      if (!nodes.has(fromId)) nodes.set(fromId, { id: fromId, label: fromId, nodeType: "rect" });
      if (!nodes.has(toId)) nodes.set(toId, { id: toId, label: toId, nodeType: "rect" });
    }

    // Parse explicit node definitions
    let nm: RegExpExecArray | null;
    nodeLineRe.lastIndex = 0;
    while ((nm = nodeLineRe.exec(line)) !== null) {
      const [, nodeId, shapePart] = nm;
      const { label, nodeType } = extractLabelAndType(shapePart);
      nodes.set(nodeId, { id: nodeId, label, nodeType });
    }
  }

  return layoutFlowchart(nodes, edges, isLR);
}

function extractLabelAndType(shapePart: string): { label: string; nodeType: NodeType } {
  if (shapePart.startsWith("{") && shapePart.endsWith("}")) {
    return { label: shapePart.slice(1, -1).trim(), nodeType: "diamond" };
  }
  if (shapePart.startsWith("((") && shapePart.endsWith("))")) {
    return { label: shapePart.slice(2, -2).trim(), nodeType: "ellipse" };
  }
  if (shapePart.startsWith("(") && shapePart.endsWith(")")) {
    return { label: shapePart.slice(1, -1).trim(), nodeType: "stadium" };
  }
  // Default: rectangle [label]
  const inner = shapePart.replace(/^\[+/, "").replace(/\]+$/, "").trim();
  return { label: inner, nodeType: "rect" };
}

function layoutFlowchart(
  nodes: Map<string, FlowNode>,
  edges: FlowEdge[],
  isLR: boolean
): Shape[] {
  const shapes: Shape[] = [];

  // Simple topological sort for layout ordering
  const order = topoSort(nodes, edges);
  const posMap = new Map<string, { x: number; y: number }>();

  // Assign positions in a layered layout
  const layers = assignLayers(order, edges);

  layers.forEach((layer, layerIdx) => {
    layer.forEach((nodeId, rowIdx) => {
      let x: number, y: number;
      if (isLR) {
        x = ORIGIN_X + layerIdx * COL_GAP;
        y = ORIGIN_Y + rowIdx * ROW_GAP;
      } else {
        x = ORIGIN_X + rowIdx * COL_GAP;
        y = ORIGIN_Y + layerIdx * ROW_GAP;
      }
      posMap.set(nodeId, { x, y });
    });
  });

  // Create node shapes
  nodes.forEach((node) => {
    const pos = posMap.get(node.id) ?? { x: ORIGIN_X, y: ORIGIN_Y };
    shapes.push(createNodeShape(node, pos));
  });

  // Create edge shapes
  edges.forEach((edge) => {
    const fromPos = posMap.get(edge.from);
    const toPos = posMap.get(edge.to);
    if (!fromPos || !toPos) return;
    shapes.push(createEdgeShape(edge, fromPos, toPos));
  });

  return shapes;
}

function createNodeShape(node: FlowNode, pos: { x: number; y: number }): Shape {
  const id = uuidv4();

  if (node.nodeType === "diamond") {
    return {
      id,
      type: "diamond",
      x: pos.x,
      y: pos.y,
      width: DIAMOND_W,
      height: DIAMOND_H,
      strokeWidth: DEFAULT_SW,
      strokeFill: DEFAULT_STROKE,
      bgFill: DEFAULT_BG,
      rounded: DEFAULT_EDGE,
      strokeStyle: DEFAULT_SS,
      roughStyle: DEFAULT_RS,
      fillStyle: DEFAULT_FS,
    };
  }

  if (node.nodeType === "ellipse" || node.nodeType === "stadium") {
    return {
      id,
      type: "ellipse",
      x: pos.x + ELLIPSE_RAD_X,
      y: pos.y + ELLIPSE_RAD_Y,
      radX: ELLIPSE_RAD_X,
      radY: ELLIPSE_RAD_Y,
      strokeWidth: DEFAULT_SW,
      strokeFill: DEFAULT_STROKE,
      bgFill: DEFAULT_BG,
      strokeStyle: DEFAULT_SS,
      roughStyle: DEFAULT_RS,
      fillStyle: DEFAULT_FS,
    };
  }

  // Default: rectangle
  return {
    id,
    type: "rectangle",
    x: pos.x,
    y: pos.y,
    width: NODE_W,
    height: NODE_H,
    strokeWidth: DEFAULT_SW,
    strokeFill: DEFAULT_STROKE,
    bgFill: DEFAULT_BG,
    rounded: DEFAULT_EDGE,
    strokeStyle: DEFAULT_SS,
    roughStyle: DEFAULT_RS,
    fillStyle: DEFAULT_FS,
  };
}

function createEdgeShape(
  edge: FlowEdge,
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number }
): Shape {
  const id = uuidv4();
  const fromCenterX = fromPos.x + NODE_W / 2;
  const fromCenterY = fromPos.y + NODE_H / 2;
  const toCenterX = toPos.x + NODE_W / 2;
  const toCenterY = toPos.y + NODE_H / 2;

  if (edge.arrowType === "arrow") {
    return {
      id,
      type: "arrow",
      x: fromCenterX,
      y: fromCenterY,
      toX: toCenterX,
      toY: toCenterY,
      strokeWidth: DEFAULT_SW,
      strokeFill: DEFAULT_STROKE,
      strokeStyle: DEFAULT_SS,
      roughStyle: DEFAULT_RS,
    };
  }
  return {
    id,
    type: "line",
    x: fromCenterX,
    y: fromCenterY,
    toX: toCenterX,
    toY: toCenterY,
    strokeWidth: DEFAULT_SW,
    strokeFill: DEFAULT_STROKE,
    strokeStyle: DEFAULT_SS,
    roughStyle: DEFAULT_RS,
  };
}

// ─── Topological sort & layer assignment ───────────────────────────────────────

function topoSort(nodes: Map<string, FlowNode>, edges: FlowEdge[]): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    edges
      .filter((e) => e.from === id)
      .forEach((e) => visit(e.to));
    result.unshift(id);
  }

  nodes.forEach((_, id) => visit(id));
  return result;
}

function assignLayers(order: string[], edges: FlowEdge[]): string[][] {
  const layerMap = new Map<string, number>();

  order.forEach((id) => {
    const incomingEdges = edges.filter((e) => e.to === id);
    if (incomingEdges.length === 0) {
      layerMap.set(id, 0);
    } else {
      const maxLayer = Math.max(
        ...incomingEdges.map((e) => (layerMap.get(e.from) ?? 0) + 1)
      );
      layerMap.set(id, maxLayer);
    }
  });

  const maxLayer = Math.max(...Array.from(layerMap.values()));
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);

  layerMap.forEach((layer, id) => layers[layer].push(id));
  return layers;
}

// ─── Sequence diagram parser ───────────────────────────────────────────────────

function parseSequenceDiagram(code: string): Shape[] {
  const lines = code.split("\n").map((l) => l.trim()).filter(Boolean);
  const actors = new Map<string, SeqActor>();
  const messages: SeqMessage[] = [];

  const participantRe = /^participant\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$/i;
  const actorRe = /^actor\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$/i;
  const msgRe = /^([A-Za-z0-9_]+)\s*(->>|->|-->>|-->)\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/;

  for (const line of lines.slice(1)) {
    let m = participantRe.exec(line) ?? actorRe.exec(line);
    if (m) {
      const id = m[1];
      const label = m[2]?.trim() ?? id;
      actors.set(id, { id, label });
      continue;
    }

    m = msgRe.exec(line);
    if (m) {
      const [, fromId, connector, toId, label] = m;
      const arrowType: "arrow" | "line" = connector.includes(">") ? "arrow" : "line";

      if (!actors.has(fromId)) actors.set(fromId, { id: fromId, label: fromId });
      if (!actors.has(toId)) actors.set(toId, { id: toId, label: toId });

      messages.push({ from: fromId, to: toId, label, arrowType });
    }
  }

  return layoutSequenceDiagram(actors, messages);
}

function layoutSequenceDiagram(
  actors: Map<string, SeqActor>,
  messages: SeqMessage[]
): Shape[] {
  const shapes: Shape[] = [];
  const actorList = Array.from(actors.values());
  const actorPosMap = new Map<string, number>(); // actor id → x center

  // Place actor boxes along the top
  actorList.forEach((actor, idx) => {
    const x = SEQ_ORIGIN_X + idx * SEQ_COL_GAP;
    const y = SEQ_ORIGIN_Y;
    actorPosMap.set(actor.id, x + ACTOR_W / 2);

    shapes.push({
      id: uuidv4(),
      type: "rectangle",
      x,
      y,
      width: ACTOR_W,
      height: ACTOR_H,
      strokeWidth: DEFAULT_SW,
      strokeFill: DEFAULT_STROKE,
      bgFill: DEFAULT_BG,
      rounded: DEFAULT_EDGE,
      strokeStyle: DEFAULT_SS,
      roughStyle: DEFAULT_RS,
      fillStyle: DEFAULT_FS,
    });
  });

  // Place message arrows below actors
  messages.forEach((msg, idx) => {
    const fromX = actorPosMap.get(msg.from) ?? SEQ_ORIGIN_X;
    const toX = actorPosMap.get(msg.to) ?? SEQ_ORIGIN_X;
    const y = SEQ_ORIGIN_Y + ACTOR_H + SEQ_ROW_GAP + idx * SEQ_ROW_GAP;

    if (msg.arrowType === "arrow") {
      shapes.push({
        id: uuidv4(),
        type: "arrow",
        x: fromX,
        y,
        toX,
        toY: y,
        strokeWidth: DEFAULT_SW,
        strokeFill: DEFAULT_STROKE,
        strokeStyle: msg.label.includes("--") ? "dashed" : DEFAULT_SS,
        roughStyle: DEFAULT_RS,
      });
    } else {
      shapes.push({
        id: uuidv4(),
        type: "line",
        x: fromX,
        y,
        toX,
        toY: y,
        strokeWidth: DEFAULT_SW,
        strokeFill: DEFAULT_STROKE,
        strokeStyle: DEFAULT_SS,
        roughStyle: DEFAULT_RS,
      });
    }
  });

  return shapes;
}
