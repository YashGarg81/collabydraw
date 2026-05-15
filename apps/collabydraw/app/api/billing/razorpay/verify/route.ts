import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import client from "@repo/db/client";

export async function POST(req: NextRequest) {
  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature,
    userId,
    type,
    credits
  } = await req.json();

  const secret = process.env.RAZORPAY_KEY_SECRET || "test_secret";

  const generated_signature = crypto
    .createHmac("sha256", secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature === razorpay_signature) {
    try {
      if (type === "pro_subscription") {
        await client.user.update({
          where: { id: userId },
          data: {
            plan: "PRO",
            subscriptionStatus: "active",
          },
        });
      } else if (type === "ai_credits") {
        const creditsToAdd = parseInt(credits || "100", 10);
        await client.user.update({
          where: { id: userId },
          data: { aiCredits: { increment: creditsToAdd } },
        });

        await client.aiUsage.create({
          data: {
            userId: userId,
            action: "credit_purchase",
            credits: creditsToAdd,
            metadata: JSON.stringify({ razorpayPaymentId: razorpay_payment_id }),
          },
        });
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("Razorpay Verification DB Error:", error);
      return NextResponse.json({ success: false, error: "Database update failed" }, { status: 500 });
    }
  } else {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
  }
}
