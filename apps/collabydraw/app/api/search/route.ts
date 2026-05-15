import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

// GET /api/search?q=... — global search across boards and templates
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) {
    return NextResponse.json({ boards: [], templates: [] });
  }

  const [boards, templates] = await Promise.all([
    client.board.findMany({
      where: {
        ownerId: session.user.id,
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: {
        id: true, name: true, description: true,
        thumbnail: true, color: true, icon: true,
        updatedAt: true, isPublic: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    // Templates are static data — filter via API route to data/templates
    Promise.resolve([]),
  ]);

  return NextResponse.json({ boards, templates });
}
