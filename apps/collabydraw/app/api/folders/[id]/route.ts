import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/folders/:id — rename, or add/remove a board
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const folder = await client.folder.findUnique({ where: { id } });
  if (!folder || folder.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  // Rename
  if (body.name !== undefined) {
    const updated = await client.folder.update({
      where: { id },
      data: { name: body.name },
    });
    return NextResponse.json({ folder: updated });
  }

  // Add board to folder
  if (body.addBoardId) {
    await client.folderBoard.upsert({
      where: { folderId_boardId: { folderId: id, boardId: body.addBoardId } },
      create: { folderId: id, boardId: body.addBoardId },
      update: {},
    });
    return NextResponse.json({ success: true });
  }

  // Remove board from folder
  if (body.removeBoardId) {
    await client.folderBoard.deleteMany({
      where: { folderId: id, boardId: body.removeBoardId },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

// DELETE /api/folders/:id — delete the folder (not its boards)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const folder = await client.folder.findUnique({ where: { id } });
  if (!folder || folder.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await client.folder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
