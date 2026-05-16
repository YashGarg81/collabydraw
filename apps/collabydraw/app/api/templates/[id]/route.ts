import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";
import { getPlanLimits } from "@/config/planLimits";

// GET /api/templates/[id] — get full template with shapes
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await client.template.findUnique({ 
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        }
      }
    }
  });
  
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

// POST /api/templates/[id] — apply template: create new board with shapes pre-loaded
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const template = await client.template.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Phase 7: Paid Template Check
  if (template.isPaid && template.authorId !== session.user.id) {
    const purchase = await client.templatePurchase.findUnique({
      where: {
        templateId_userId: {
          templateId: id,
          userId: session.user.id
        }
      }
    });

    if (!purchase) {
      return NextResponse.json(
        { 
          error: "PAYMENT_REQUIRED", 
          message: "You must purchase this template before using it.",
          price: template.price 
        }, 
        { status: 402 }
      );
    }
  }

  // Plan enforcement — same limit as creating a blank board
  const user = await client.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, trialEndsAt: true },
  });
  const limits = getPlanLimits(user?.plan ?? "FREE", user?.trialEndsAt);
  if (limits.boards !== Infinity) {
    const count = await client.board.count({ where: { ownerId: session.user.id } });
    if (count >= limits.boards) {
      return NextResponse.json(
        {
          error: "PLAN_LIMIT",
          message: `You've reached the ${limits.boards}-board limit on the Free plan. Upgrade to Pro for unlimited boards.`,
          limit: limits.boards,
          current: count,
        },
        { status: 403 }
      );
    }
  }

  const board = await client.board.create({
    data: {
      name: template.name,
      description: template.description,
      ownerId: session.user.id,
      shapes: template.shapes,
    },
  });

  // Phase 7: Increment download count
  await client.template.update({
    where: { id: template.id },
    data: { downloads: { increment: 1 } }
  });

  return NextResponse.json({ board }, { status: 201 });
}
