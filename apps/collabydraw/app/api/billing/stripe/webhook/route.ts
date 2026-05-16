import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import client from "@repo/db/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_123", {
  apiVersion: "2026-04-22.dahlia" as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !endpointSecret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (!userId) break;

        if (session.mode === "subscription") {
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subAny = subscription as any;
          const periodEnd = subAny.current_period_end ?? subAny.items?.data?.[0]?.current_period_end ?? 0;
          
          await client.subscription.create({
            data: {
              userId: userId,
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: customerId,
              stripePriceId: subscription.items.data[0]!.price.id,
              status: subscription.status,
              currentPeriodEnd: new Date(periodEnd * 1000),
            },
          });

          await client.user.update({
            where: { id: userId },
            data: {
              plan: "PRO",
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
            },
          });
        } else if (session.mode === "payment" && session.metadata?.action === "ai_credit_topup") {
          const creditsToAdd = parseInt(session.metadata.credits || "100", 10);
          
          await client.user.update({
            where: { id: userId },
            data: { aiCredits: { increment: creditsToAdd } },
          });

          await client.aiUsage.create({
            data: {
              userId: userId,
              action: "credit_purchase",
              credits: creditsToAdd,
              metadata: JSON.stringify({ checkoutSessionId: session.id }),
            },
          });
        }
        break;
      }
      
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subAny = subscription as any;
        const periodEnd = subAny.current_period_end ?? subAny.items?.data?.[0]?.current_period_end ?? 0;
        
        await client.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status,
            currentPeriodEnd: new Date(periodEnd * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
        });

        const sub = await client.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
          select: { userId: true },
        });

        if (sub) {
          const newPlan = subscription.status === "active" || subscription.status === "trialing" ? "PRO" : "FREE";
          await client.user.update({
            where: { id: sub.userId },
            data: {
              plan: newPlan,
              subscriptionStatus: subscription.status,
            },
          });
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
