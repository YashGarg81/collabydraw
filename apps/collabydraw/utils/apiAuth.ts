import { NextRequest, NextResponse } from "next/server";
import client from "@repo/db/client";

export async function validateApiKey(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 }) };
  }

  const key = authHeader.split(" ")[1];
  if (!key) {
    return { error: NextResponse.json({ error: "API key is required" }, { status: 401 }) };
  }

  // Find the API key
  const apiKey = await client.apiKey.findUnique({
    where: { key },
    include: { user: true },
  });

  if (!apiKey) {
    return { error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };
  }

  // Update last used timestamp
  await client.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return { user: apiKey.user, apiKey };
}
