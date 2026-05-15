import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";
import { getPlanLimits } from "@/config/planLimits";

// Plan limit check logic below

// GET /api/boards?sort=newest|oldest|name — list all boards owned by the current user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sort = req.nextUrl.searchParams.get("sort") ?? "newest";
  const orderBy =
    sort === "oldest"  ? { createdAt: "asc"  as const } :
    sort === "name"    ? { name:      "asc"  as const } :
    /* newest default */{ updatedAt:  "desc" as const };

  const boards = await client.board.findMany({
    where: { ownerId: session.user.id },
    orderBy: [{ isPinned: "desc" }, orderBy],   // pinned always first
    select: {
      id: true,
      name: true,
      description: true,
      thumbnail: true,
      isPublic: true,
      publicRole: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      shapes: true,
      _count: { select: { members: true } },
    },
  });

  // Attach shape count from stored JSON
  const boardsWithMeta = boards.map((b) => {
    let shapeCount = 0;
    try { shapeCount = (JSON.parse(b.shapes) as unknown[]).length; } catch {}
    return { ...b, shapes: undefined, shapeCount };
  });

  const user = await client.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, aiCredits: true, trialEndsAt: true },
  });

  const limits = getPlanLimits(user?.plan ?? "FREE", user?.trialEndsAt);
  const boardCount = boards.length;
  const boardLimit = limits.boards === Infinity ? null : limits.boards;
  const atLimit = boardLimit !== null && boardCount >= boardLimit;

  return NextResponse.json({
    boards: boardsWithMeta,
    meta: { plan: user?.plan ?? "FREE", boardCount, boardLimit, atLimit, aiCredits: user?.aiCredits ?? 0 },
  });
}

// POST /api/boards — create a new board OR duplicate an existing one
// Body: { name } | { duplicateFrom: boardId }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await client.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, trialEndsAt: true },
  });
  const limits = getPlanLimits(user?.plan ?? "FREE", user?.trialEndsAt);

  if (limits.boards !== Infinity) {
    const count = await client.board.count({ where: { ownerId: session.user.id } });
    if (count >= limits.boards) {
      return NextResponse.json(
        {
          error: "PLAN_LIMIT",
          message: `You have reached the ${limits.boards}-board limit on the Free plan. Upgrade to Pro for unlimited boards.`,
          limit: limits.boards, current: count, plan: user?.plan ?? "FREE",
        },
        { status: 403 }
      );
    }
  }

  const body = await req.json().catch(() => ({}));

  // Duplicate flow
  if (body.duplicateFrom) {
    const source = await client.board.findUnique({ where: { id: body.duplicateFrom } });
    if (!source || source.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Source board not found" }, { status: 404 });
    }
    const board = await client.board.create({
      data: {
        name: `${source.name} (copy)`,
        description: source.description,
        ownerId: session.user.id,
        shapes: source.shapes,
        isPublic: false,
        isPinned: false,
      },
    });
    return NextResponse.json({ board }, { status: 201 });
  }

  // Normal create
  const name = (body.name as string) || "Untitled Board";
  const description = (body.description as string) || null;
  const board = await client.board.create({
    data: { name, description, ownerId: session.user.id, shapes: "[]" },
  });

  return NextResponse.json({ board }, { status: 201 });
}
