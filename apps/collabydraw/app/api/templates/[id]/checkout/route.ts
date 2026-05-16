import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import client from "@repo/db/client";

// POST /api/templates/[id]/checkout
// Mock endpoint to simulate purchasing a template
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await client.template.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (!template.isPaid) {
      return NextResponse.json({ error: "Template is free" }, { status: 400 });
    }

    if (template.authorId === session.user.id) {
      return NextResponse.json({ error: "You cannot purchase your own template" }, { status: 400 });
    }

    // Check if already purchased
    const existingPurchase = await client.templatePurchase.findUnique({
      where: {
        templateId_userId: {
          templateId: id,
          userId: session.user.id
        }
      }
    });

    if (existingPurchase) {
      return NextResponse.json({ error: "Template already purchased" }, { status: 400 });
    }

    // Mock purchase: Create the purchase record
    const purchase = await client.templatePurchase.create({
      data: {
        templateId: template.id,
        userId: session.user.id,
        price: template.price,
      }
    });

    return NextResponse.json({ success: true, purchase }, { status: 201 });
  } catch (error) {
    console.error("[TEMPLATE_CHECKOUT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
