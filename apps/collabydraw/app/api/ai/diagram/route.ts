/**
 * Wave 8: AI Diagram Generation API Route
 * POST /api/ai/diagram
 *
 * Accepts a natural-language prompt and calls Google Gemini
 * to return a structured CollabyDraw Shape array.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── System prompt with full Shape schema ──────────────────────────────────────

const SYSTEM_PROMPT = `You are a diagramming assistant for CollabyDraw, a collaborative drawing canvas app.

Your job is to convert a natural language description into a JSON array of shapes that can be rendered on the canvas.

## Canvas coordinate system
- Origin (0, 0) is top-left
- X increases rightward, Y increases downward
- Layout shapes starting from x=80, y=80 with generous spacing (160px horizontal, 120px vertical between nodes)

## Shape types you can use

### rectangle
{ "id": "<uuid>", "type": "rectangle", "x": number, "y": number, "width": number (120–200), "height": number (50–80), "strokeWidth": 1, "strokeFill": "rgba(255, 255, 255)", "bgFill": "rgba(18, 18, 18)", "rounded": "round", "strokeStyle": "solid", "roughStyle": 1, "fillStyle": "solid" }

### ellipse
{ "id": "<uuid>", "type": "ellipse", "x": number (center x), "y": number (center y), "radX": number (60–100), "radY": number (30–50), "strokeWidth": 1, "strokeFill": "rgba(255, 255, 255)", "bgFill": "rgba(18, 18, 18)", "strokeStyle": "solid", "roughStyle": 1, "fillStyle": "solid" }

### diamond
{ "id": "<uuid>", "type": "diamond", "x": number, "y": number, "width": number (140–200), "height": number (70–100), "strokeWidth": 1, "strokeFill": "rgba(255, 255, 255)", "bgFill": "rgba(18, 18, 18)", "rounded": "round", "strokeStyle": "solid", "roughStyle": 1, "fillStyle": "solid" }

### arrow (directed connection)
{ "id": "<uuid>", "type": "arrow", "x": number (start x), "y": number (start y), "toX": number (end x), "toY": number (end y), "strokeWidth": 1, "strokeFill": "rgba(255, 255, 255)", "strokeStyle": "solid", "roughStyle": 1 }

### line (undirected connection)
{ "id": "<uuid>", "type": "line", "x": number, "y": number, "toX": number, "toY": number, "strokeWidth": 1, "strokeFill": "rgba(255, 255, 255)", "strokeStyle": "solid", "roughStyle": 1 }

### text (label)
{ "id": "<uuid>", "type": "text", "x": number, "y": number, "width": number, "height": 30, "text": "string", "fontSize": "Small", "fontFamily": "normal", "fontStyle": "normal", "textAlign": "center", "strokeFill": "rgba(255, 255, 255)" }

## Rules
1. Use UUIDs for all ids (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx — generate plausible fake UUIDs)
2. Place shapes in a logical layout — left to right or top to bottom
3. Connect nodes with arrows where the flow description implies direction
4. Add text labels near shapes for labeling when helpful
5. Return ONLY a valid JSON array — no markdown, no explanation, no code fences
6. Maximum 40 shapes total
7. strokeFill must always be "rgba(255, 255, 255)" and bgFill must always be "rgba(18, 18, 18)"

Respond with ONLY the JSON array.`;

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body as { prompt?: string };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured. Set GEMINI_API_KEY in your environment." },
        { status: 503 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(prompt.trim());
    const text = result.response.text().trim();

    // Strip any accidental markdown code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let shapes;
    try {
      shapes = JSON.parse(cleaned);
    } catch {
      console.error("Gemini returned non-JSON:", cleaned);
      return NextResponse.json(
        { error: "AI returned malformed response. Please try again." },
        { status: 500 }
      );
    }

    if (!Array.isArray(shapes)) {
      return NextResponse.json(
        { error: "AI returned unexpected format. Expected an array of shapes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ shapes });
  } catch (err) {
    console.error("AI diagram generation error:", err);

    // Detect rate-limit (429) specifically
    const errStr = String(err);
    if (errStr.includes("429") || errStr.includes("Too Many Requests") || errStr.includes("quota")) {
      // Try to extract retry delay from the error message
      const retryMatch = errStr.match(/retry[^\d]*(\d+)/i);
      const retrySec = retryMatch ? Math.ceil(Number(retryMatch[1])) : 60;
      return NextResponse.json(
        { error: `Rate limit reached — the free Gemini quota was exceeded. Please wait ~${retrySec}s and try again.` },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate diagram. Please try again." },
      { status: 500 }
    );
  }
}
