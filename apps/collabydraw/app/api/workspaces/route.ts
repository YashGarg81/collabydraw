import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

// GET /api/workspaces — List all workspaces where the user is a member
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await client.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: {
      workspace: {
        include: {
          _count: { select: { boards: true, members: true } }
        }
      }
    }
  });

  return NextResponse.json({ workspaces: memberships.map(m => m.workspace) });
}

// POST /api/workspaces — Create a new workspace
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const workspace = await client.workspace.create({
    data: {
      name,
      members: {
        create: {
          userId: session.user.id,
          role: "OWNER"
        }
      }
    }
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
