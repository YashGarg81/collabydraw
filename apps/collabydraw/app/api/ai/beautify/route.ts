import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPlanLimits } from "@/config/planLimits";

const BEAUTIFY_PROMPT = `You are a professional diagram designer. 
You will receive a JSON array of shapes representing a rough, hand-drawn diagram. 
Your goal is to "beautify" it:
1. ALIGNMENT: Align nodes horizontally or vertically if they are close.
2. CONSISTENCY: Make similar shapes (e.g., all rectangles in a flow) have the exact same width and height.
3. SPACING: Ensure equal spacing between elements where appropriate.
4. CONNECTIONS: Adjust arrows so they start and end exactly at the edges of the shapes they connect.
5. STYLE: Keep the "rough" style but make it look like a "clean" architectural diagram.

Return ONLY the updated JSON array of shapes. No markdown, no explanations.`;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await client.user.findUnique({
      where: { id: session.user.id },
      select: { aiCredits: true, plan: true, trialEndsAt: true }
    });

    const limits = getPlanLimits(user?.plan ?? "FREE", user?.trialEndsAt);
    if (limits.aiCreditsMonthly !== Infinity && (user?.aiCredits ?? 0) <= 0) {
      return NextResponse.json({ error: "No AI credits remaining" }, { status: 402 });
    }

    const { shapes } = await req.json();
    if (!shapes || !Array.isArray(shapes)) {
      return NextResponse.json({ error: "Invalid shapes provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `${BEAUTIFY_PROMPT}\n\nINPUT SHAPES:\n${JSON.stringify(shapes, null, 2)}`;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const beautifiedShapes = JSON.parse(cleaned);

    // Deduct credit
    await client.user.update({
      where: { id: session.user.id },
      data: { aiCredits: { decrement: 1 } }
    });

    return NextResponse.json({ shapes: beautifiedShapes });
  } catch (error) {
    console.error("[AI_BEAUTIFY]", error);
    return NextResponse.json({ error: "Failed to beautify diagram" }, { status: 500 });
  }
}
