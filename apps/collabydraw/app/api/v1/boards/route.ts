import { NextRequest, NextResponse } from "next/server";
import client from "@repo/db/client";
import { validateApiKey } from "@/utils/apiAuth";
import { getPlanLimits } from "@/config/planLimits";
import { fireWebhook } from "@/lib/webhooks";

// GET /api/v1/boards — List all boards for the authenticated user
export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req);
  if (auth.error) return auth.error;

  const user = auth.user!;
  
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

  const boards = await client.board.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 100),
    skip: offset,
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  return NextResponse.json({
    data: boards,
    meta: {
      total: await client.board.count({ where: { ownerId: user.id } }),
      limit,
      offset,
    }
  });
}

// POST /api/v1/boards — Create a new board
export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req);
  if (auth.error) return auth.error;

  const user = auth.user!;
  const limits = getPlanLimits(user.plan, user.trialEndsAt);

  if (limits.boards !== Infinity) {
    const count = await client.board.count({ where: { ownerId: user.id } });
    if (count >= limits.boards) {
      return NextResponse.json({ error: "Board limit reached for your plan" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const board = await client.board.create({
    data: {
      name: body.name,
      description: body.description || null,
      isPublic: body.isPublic ?? false,
      ownerId: user.id,
      shapes: body.shapes || "[]",
    },
  });

  // Dispatch webhook event
  await fireWebhook(user.id, "board.created", board);

  return NextResponse.json({ data: board }, { status: 201 });
}
