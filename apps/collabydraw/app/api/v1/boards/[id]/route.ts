import { NextRequest, NextResponse } from "next/server";
import client from "@repo/db/client";
import { validateApiKey } from "@/utils/apiAuth";

// GET /api/v1/boards/[id] — Get specific board details
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const user = auth.user!;

  const board = await client.board.findUnique({
    where: { id },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  if (board.ownerId !== user.id && !board.isPublic) {
    // Check if member
    const member = await client.boardMember.findFirst({
      where: { boardId: id, userId: user.id }
    });
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Parse shapes string to JSON for the API response
  let shapes = [];
  try {
    shapes = JSON.parse(board.shapes);
  } catch {}

  return NextResponse.json({
    data: {
      ...board,
      shapes,
    }
  });
}
