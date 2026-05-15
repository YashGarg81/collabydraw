import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

const MAX_SNAPSHOTS = 20; // keep last 20 versions per board

type Params = { params: Promise<{ id: string }> };

// GET /api/boards/[id]/snapshots — list all snapshots (no shapes payload for perf)
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const board = await client.board.findUnique({ where: { id }, select: { ownerId: true } });
  if (!board || board.ownerId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const snapshots = await client.boardSnapshot.findMany({
    where: { boardId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, shapeCount: true, createdAt: true },
  });

  return NextResponse.json({ snapshots });
}

// POST /api/boards/[id]/snapshots — create snapshot of current board state
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const board = await client.board.findUnique({
    where: { id },
    select: { ownerId: true, shapes: true },
  });
  if (!board || board.ownerId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const label: string | undefined = body.label;

  let shapeCount = 0;
  try { shapeCount = JSON.parse(board.shapes).length; } catch { shapeCount = 0; }

  const snapshot = await client.boardSnapshot.create({
    data: { boardId: id, shapes: board.shapes, label: label ?? null, shapeCount },
  });

  // Prune: keep only the latest MAX_SNAPSHOTS
  const all = await client.boardSnapshot.findMany({
    where: { boardId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (all.length > MAX_SNAPSHOTS) {
    const toDelete = all.slice(MAX_SNAPSHOTS).map(s => s.id);
    await client.boardSnapshot.deleteMany({ where: { id: { in: toDelete } } });
  }

  return NextResponse.json({ snapshot }, { status: 201 });
}

// DELETE /api/boards/[id]/snapshots?snapshotId=xxx — delete a specific snapshot
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const board = await client.board.findUnique({ where: { id }, select: { ownerId: true } });
  if (!board || board.ownerId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const snapshotId = new URL(req.url).searchParams.get("snapshotId");
  if (!snapshotId) return NextResponse.json({ error: "snapshotId required" }, { status: 400 });

  await client.boardSnapshot.delete({ where: { id: snapshotId } });
  return NextResponse.json({ success: true });
}

// PATCH /api/boards/[id]/snapshots — restore a snapshot to the board
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const board = await client.board.findUnique({ where: { id }, select: { ownerId: true } });
  if (!board || board.ownerId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { snapshotId } = await req.json();
  const snapshot = await client.boardSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot || snapshot.boardId !== id)
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });

  // Save current state as a new snapshot before restoring (so you can undo the restore)
  const current = await client.board.findUnique({ where: { id }, select: { shapes: true } });
  if (current) {
    let shapeCount = 0;
    try { shapeCount = JSON.parse(current.shapes).length; } catch { shapeCount = 0; }
    await client.boardSnapshot.create({
      data: { boardId: id, shapes: current.shapes, label: "Before restore", shapeCount },
    });
  }

  // Restore
  const updated = await client.board.update({
    where: { id },
    data: { shapes: snapshot.shapes },
  });

  return NextResponse.json({ board: updated, restored: true });
}
