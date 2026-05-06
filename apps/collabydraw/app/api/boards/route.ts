import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

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

  return NextResponse.json({ boards });
}

// POST /api/boards — create a new board
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
