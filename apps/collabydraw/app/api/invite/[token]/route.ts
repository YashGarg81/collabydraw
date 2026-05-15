import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

// GET /api/invite/[token] — accept a board invite
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Redirect to signin if not logged in
    return NextResponse.redirect(new URL("/auth/signin", _req.url));
  }

  const { token } = await params;
  const invite = await client.boardInvite.findUnique({
    where: { token },
    include: { board: true },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
  }

  if (invite.accepted) {
    return NextResponse.redirect(new URL(`/canvas?board=${invite.boardId}`, _req.url));
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  // Create membership
  await client.$transaction([
    client.boardMember.create({
      data: {
        boardId: invite.boardId,
        userId: session.user.id,
        role: invite.role,
      },
    }),
    client.boardInvite.update({
      where: { token },
      data: { accepted: true },
    }),
    // Create a notification for the board owner
    client.notification.create({
      data: {
        userId: invite.board.ownerId,
        type: "member_joined",
        payload: JSON.stringify({
          boardId: invite.boardId,
          boardName: invite.board.name,
          actorName: session.user.name || "A user",
          message: `${session.user.name || "A user"} accepted your invite to ${invite.board.name}.`,
        }),
      },
    }),
  ]);

  return NextResponse.redirect(new URL(`/canvas?board=${invite.boardId}`, _req.url));
}
