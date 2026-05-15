import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

// POST /api/billing/mock-upgrade — mock upgrade to PRO
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updated = await client.user.update({
    where: { id: session.user.id },
    data: {
      plan: "PRO",
      stripeSubscriptionId: "mock_sub_" + Math.random().toString(36).substring(7),
    },
  });

  return NextResponse.json({ user: updated });
}
