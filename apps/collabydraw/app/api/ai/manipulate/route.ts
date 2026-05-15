/**
 * Phase 3C: AI Board Manipulation API
 * POST /api/ai/manipulate
 *
 * Actions:
 *  - "layout"    → auto-arrange all shapes in a clean grid (client-side math, no AI credits)
 *  - "cluster"   → group shapes by type into spatial clusters (client-side math)
 *  - "summarize" → Gemini reads shape metadata and returns a text summary (uses 1 AI credit)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPlanLimits } from "@/config/planLimits";
import { v4 as uuidv4 } from "uuid";

type Action = "layout" | "cluster" | "summarize";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyShape = Record<string, any>;

// ── Layout: arrange all shapes in a responsive grid ─────────────────────────

const COL_W = 200;
const ROW_H = 140;
const GRID_COLS = 4;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

function computeGridLayout(shapes: AnyShape[]): AnyShape[] {
  return shapes.map((s, i) => {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const newX = ORIGIN_X + col * COL_W;
    const newY = ORIGIN_Y + row * ROW_H;
    if ("x" in s && "y" in s) return { ...s, x: newX, y: newY };
    return s; // free-draw / embed — leave untouched
  });
}

// ── Cluster: group shapes by type into separate spatial zones ───────────────

const TYPE_ORDER = ["ellipse", "diamond", "rectangle", "arrow", "line", "text", "sticky", "free-draw", "frame", "embed"];
const CLUSTER_GAP = 60;

function computeClusterLayout(shapes: AnyShape[]): AnyShape[] {
  // Group by type
  const groups: Record<string, AnyShape[]> = {};
  for (const s of shapes) {
    const t = (s.type as string) || "other";
    if (!groups[t]) groups[t] = [];
    groups[t].push(s);
  }

  const result: AnyShape[] = [];
  let cursorX = ORIGIN_X;

  for (const type of [...TYPE_ORDER, ...Object.keys(groups).filter(t => !TYPE_ORDER.includes(t))]) {
    const group = groups[type];
    if (!group || group.length === 0) continue;

    const cols = Math.ceil(Math.sqrt(group.length));
    const cursorY = ORIGIN_Y;

    group.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      if ("x" in s && "y" in s) {
        result.push({ ...s, x: cursorX + col * COL_W, y: cursorY + row * ROW_H });
      } else {
        result.push(s);
      }
    });

    // Advance X by cluster width + gap
    cursorX += cols * COL_W + CLUSTER_GAP;
  }

  return result;
}

// ── Summarize: Gemini reads shape metadata and returns a sticky note ─────────

async function summarizeBoard(shapes: AnyShape[], apiKey: string): Promise<AnyShape> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const meta = shapes.map(s => ({
    type: s.type,
    label: s.text ?? s.type,
    ...(s.x != null ? { x: Math.round(s.x), y: Math.round(s.y) } : {}),
  }));

  const prompt = `You are analyzing a collaborative whiteboard canvas.
Here is a list of shapes on the canvas (as JSON):
${JSON.stringify(meta, null, 2)}

Write a concise 2–4 sentence summary describing what this diagram appears to represent.
Be specific about the types of shapes, their likely purpose, and any implied workflow or structure.
Respond with ONLY the summary text — no markdown, no headings.`;

  const result = await model.generateContent(prompt);
  const summary = result.response.text().trim();

  // Build a sticky note shape at the top-right corner
  const stickyNote: AnyShape = {
    id: uuidv4(),
    type: "sticky",
    x: 1100,
    y: 80,
    width: 300,
    height: 180,
    text: `📋 Board Summary\n\n${summary}`,
    fontSize: "Small",
    fontFamily: "normal",
    fontStyle: "normal",
    textAlign: "left",
    strokeFill: "#fbbf24",
    bgFill: "#fef08a",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughStyle: 0,
    fillStyle: "solid",
  };

  return stickyNote;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { action?: Action; shapes?: AnyShape[] };

  // 1. Parse body — catch JSON parse errors early
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body. Expected JSON." }, { status: 400 });
  }

  const { action, shapes } = body;

  if (!action || !["layout", "cluster", "summarize"].includes(action)) {
    return NextResponse.json({ error: "Invalid action. Use: layout | cluster | summarize" }, { status: 400 });
  }
  if (!Array.isArray(shapes) || shapes.length === 0) {
    return NextResponse.json({ error: "Shapes array is required and must not be empty." }, { status: 400 });
  }

  // 2. layout & cluster: pure math — isolated try/catch, no AI/DB
  if (action === "layout") {
    try {
      const updated = computeGridLayout(shapes);
      return NextResponse.json({ shapes: updated });
    } catch (err) {
      console.error("Layout error:", err);
      return NextResponse.json({ error: "Layout computation failed." }, { status: 500 });
    }
  }

  if (action === "cluster") {
    try {
      const updated = computeClusterLayout(shapes);
      return NextResponse.json({ shapes: updated });
    } catch (err) {
      console.error("Cluster error:", err);
      return NextResponse.json({ error: "Cluster computation failed." }, { status: 500 });
    }
  }

  // 3. summarize: requires Gemini + auth
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        { error: "AI summarization is not configured (missing GEMINI_API_KEY)." },
        { status: 503 }
      );
    }

    // Credit check
    if (userId) {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: { plan: true, aiCredits: true, trialEndsAt: true },
      });
      const limits = getPlanLimits(user?.plan ?? "FREE", user?.trialEndsAt);
      if (limits.aiCreditsMonthly !== Infinity && (user?.aiCredits ?? 0) <= 0) {
        return NextResponse.json(
          { error: "NO_AI_CREDITS", message: "You've used all your AI credits. Upgrade to Pro for more." },
          { status: 402 }
        );
      }
    }

    const stickyNote = await summarizeBoard(shapes, apiKey);

    // Decrement 1 credit
    if (userId) {
      const user = await client.user.findUnique({ where: { id: userId }, select: { plan: true, trialEndsAt: true } });
      const limits = getPlanLimits(user?.plan ?? "FREE", user?.trialEndsAt);
      if (limits.aiCreditsMonthly !== Infinity) {
        await client.user.update({ where: { id: userId }, data: { aiCredits: { decrement: 1 } } });
      }
    }

    return NextResponse.json({ stickyNote });
  } catch (err) {
    console.error("AI summarize error:", err);
    const errStr = String(err);

    if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota")) {
      return NextResponse.json({ error: "AI rate limit reached. Please wait a moment and try again." }, { status: 429 });
    }
    if (errStr.includes("API_KEY_INVALID") || errStr.includes("API key not valid") || errStr.includes("PERMISSION_DENIED")) {
      return NextResponse.json({ error: "Gemini API key is invalid. Check GEMINI_API_KEY in .env." }, { status: 503 });
    }
    if (errStr.includes("404") || errStr.includes("MODEL_NOT_FOUND")) {
      return NextResponse.json({ error: "AI model unavailable. Please try again later." }, { status: 503 });
    }

    const message =
      process.env.NODE_ENV === "development"
        ? `AI error: ${errStr.slice(0, 200)}`
        : "AI summarization failed. Please try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
