import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await client.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  });

  const reports = await client.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      reporter: {
        select: { name: true, email: true }
      }
    }
  });

  return NextResponse.json({ logs, reports });
}
