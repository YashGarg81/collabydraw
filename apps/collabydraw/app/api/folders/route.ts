import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

// GET /api/folders — list all folders for the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folders = await client.folder.findMany({
    where: { ownerId: session.user.id },
    include: {
      boards: {
        include: {
          board: {
            select: { id: true, name: true, thumbnail: true, updatedAt: true, color: true, icon: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ folders });
}

// POST /api/folders — create a new folder
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string)?.trim() || "New Folder";

  const folder = await client.folder.create({
    data: { name, ownerId: session.user.id },
  });

  return NextResponse.json({ folder }, { status: 201 });
}
