import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

// POST /api/boards/[id]/invites — invite a user by email
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const board = await client.board.findUnique({
    where: { id: boardId },
    include: { owner: true },
  });

  if (!board || board.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email, role = "VIEWER" } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user is already a member
  const existingMember = await client.boardMember.findFirst({
    where: { boardId, user: { email } },
  });
  if (existingMember) {
    return NextResponse.json({ error: "User is already a member" }, { status: 400 });
  }

  // Create invite
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const invite = await client.boardInvite.create({
    data: {
      boardId,
      email,
      role,
      expiresAt,
    },
  });

  // Log the invite link in development (since we don't have an email provider yet)
  console.log(`[INVITE] Invite sent to ${email} for board ${board.name}. Link: /invite/${invite.token}`);

  return NextResponse.json({ invite });
}

// GET /api/boards/[id]/invites — list pending invites
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = await params;
  const invites = await client.boardInvite.findMany({
    where: { boardId, accepted: false },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites });
}
