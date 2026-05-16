import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import Stripe from "stripe";
import client from "@repo/db/client";

// Ensure you set STRIPE_SECRET_KEY in your .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_123", {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, successUrl, cancelUrl } = await req.json();

  if (!type) {
    return NextResponse.json({ error: "Checkout type is required" }, { status: 400 });
  }

  try {
    const user = await client.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) throw new Error("User not found");

    // 1. Create or retrieve Stripe Customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await client.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // 2. Create Checkout Session
    let sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?canceled=true`,
      client_reference_id: user.id,
      line_items: [],
      mode: "subscription",
      allow_promotion_codes: true, // Allow promo codes
    };

    if (type === "pro_subscription") {
      const priceId = process.env.STRIPE_PRO_PRICE_ID;
      if (!priceId) throw new Error("STRIPE_PRO_PRICE_ID is not configured");

      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
      sessionParams.mode = "subscription";
      
    } else if (type === "ai_credits") {
      const priceId = process.env.STRIPE_AI_CREDITS_PRICE_ID;
      if (!priceId) throw new Error("STRIPE_AI_CREDITS_PRICE_ID is not configured");

      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
      sessionParams.mode = "payment";
      sessionParams.metadata = { action: "ai_credit_topup", credits: "100" };
    } else {
      return NextResponse.json({ error: "Invalid checkout type" }, { status: 400 });
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
