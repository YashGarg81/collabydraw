import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return false;
  }
  return session.user.id;
}

// POST /api/admin/users/[id]/ban
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await isAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const isBanned = body.isBanned ?? true;

  const user = await client.user.update({
    where: { id },
    data: { isBanned }
  });

  // Create Audit Log
  await client.auditLog.create({
    data: {
      userId: adminId,
      action: isBanned ? "USER_BAN" : "USER_UNBAN",
      resourceId: id,
      metadata: JSON.stringify({ email: user.email })
    }
  });

  return NextResponse.json({ success: true, user });
}
