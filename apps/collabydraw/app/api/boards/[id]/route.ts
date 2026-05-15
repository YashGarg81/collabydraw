import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";
import { fireWebhook } from "../../../lib/webhooks";

type Params = { params: Promise<{ id: string }> };

// GET /api/boards/:id
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const board = await client.board.findUnique({
    where: { id },
    include: { members: { include: { user: { select: { id: true, name: true, image: true } } } } },
  });

  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const isOwner = board.ownerId === session.user.id;
  const member = board.members.find((m) => m.userId === session.user.id);
  const isMember = !!member;
  if (!isOwner && !isMember && !board.isPublic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let role = "VIEWER";
  if (isOwner) role = "OWNER";
  else if (member) role = member.role;
  else if (board.isPublic) role = board.publicRole;

  return NextResponse.json({ board, role });
}

// PATCH /api/boards/:id — update name, description, thumbnail, shapes
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const board = await client.board.findUnique({ where: { id } });
  if (!board || board.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updated = await client.board.update({
    where: { id },
    data: {
      ...(body.name        !== undefined && { name:        body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.thumbnail   !== undefined && { thumbnail:   body.thumbnail }),
      ...(body.color       !== undefined && { color:       body.color }),
      ...(body.icon        !== undefined && { icon:        body.icon }),
      ...(body.shapes      !== undefined && { shapes:      JSON.stringify(body.shapes) }),
      ...(body.isPublic    !== undefined && { isPublic:    body.isPublic }),
      ...(body.publicRole  !== undefined && { publicRole:  body.publicRole }),
      ...(body.isPinned    !== undefined && { isPinned:    body.isPinned }),
    },
  });

  await fireWebhook(session.user.id, "board.updated", updated);

  return NextResponse.json({ board: updated });
}

// DELETE /api/boards/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const board = await client.board.findUnique({ where: { id } });
  if (!board || board.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await client.board.delete({ where: { id } });
  await fireWebhook(session.user.id, "board.deleted", { id });
  return NextResponse.json({ success: true });
}
