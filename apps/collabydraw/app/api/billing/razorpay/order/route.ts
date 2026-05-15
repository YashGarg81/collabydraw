import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_123",
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, amount, currency = "INR" } = await req.json();

  if (!type || !amount) {
    return NextResponse.json({ error: "Type and amount are required" }, { status: 400 });
  }

  try {
    const options = {
      amount: amount * 100, // amount in the smallest currency unit
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: session.user.id,
        type: type,
        credits: type === "ai_credits" ? "100" : "0",
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json(order);
  } catch (error: any) {
    console.error("Razorpay Order Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
