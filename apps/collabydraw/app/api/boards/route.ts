import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";
import { getPlanLimits } from "@/config/planLimits";

// GET /api/boards — list all boards owned by the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boards = await client.board.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      thumbnail: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { members: true } },
    },
  });

  // Also return current user plan info for dashboard
  const user = await client.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, aiCredits: true },
  });

  const limits = getPlanLimits(user?.plan ?? "FREE");
  const boardCount = boards.length;
  const boardLimit = limits.boards === Infinity ? null : limits.boards;
  const atLimit = boardLimit !== null && boardCount >= boardLimit;

  return NextResponse.json({ boards, meta: { plan: user?.plan ?? "FREE", boardCount, boardLimit, atLimit, aiCredits: user?.aiCredits ?? 0 } });
}

// POST /api/boards — create a new board (enforces plan board limit)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Plan enforcement ────────────────────────────────────────────────
  const user = await client.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  const limits = getPlanLimits(user?.plan ?? "FREE");
  if (limits.boards !== Infinity) {
    const count = await client.board.count({ where: { ownerId: session.user.id } });
    if (count >= limits.boards) {
      return NextResponse.json(
        {
          error: "PLAN_LIMIT",
          message: `You have reached the ${limits.boards}-board limit on the Free plan. Upgrade to Pro for unlimited boards.`,
          limit: limits.boards,
          current: count,
          plan: user?.plan ?? "FREE",
        },
        { status: 403 }
      );
    }
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string) || "Untitled Board";
  const description = (body.description as string) || null;

  const board = await client.board.create({
    data: {
      name,
      description,
      ownerId: session.user.id,
      shapes: "[]",
    },
  });

  return NextResponse.json({ board }, { status: 201 });
}
