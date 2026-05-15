"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeft, Loader2, CreditCard, Zap, CheckCircle2, AlertTriangle, Check, Crown, Smartphone } from "lucide-react";
import { PLAN_DISPLAY, PLAN_COLORS } from "@/config/planLimits";

export default function BillingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin?callbackUrl=/dashboard/billing");
    if (status === "authenticated") fetchUserData();
  }, [status, router]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Create a quick endpoint or reuse an existing one to get full user billing info
      const res = await fetch("/api/auth/session"); // Next-auth session usually doesn't have everything
      // Let's use the dashboard board endpoint which returns plan meta, or create a specific one
      const infoRes = await fetch("/api/boards?limit=1"); 
      if (infoRes.ok) {
        const data = await infoRes.json();
        setUser({
          plan: data.meta.plan,
          aiCredits: data.meta.aiCredits,
          // We can't easily get trialEndsAt from generic endpoints without a specific one, 
          // but we can assume it's part of the plan meta if we update it.
        });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleStripeCheckout = async (type: "pro_subscription" | "ai_credits") => {
    setCheckoutLoading(type + "_stripe");
    try {
      const res = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to initiate checkout");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred. Please try again.");
    }
    setCheckoutLoading(null);
  };

  const handleRazorpayCheckout = async (type: "pro_subscription" | "ai_credits") => {
    setCheckoutLoading(type + "_razorpay");
    try {
      const amount = type === "pro_subscription" ? 999 : 499; // Mock amounts in INR
      const res = await fetch("/api/billing/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount }),
      });
      const order = await res.json();

      if (order.error) throw new Error(order.error);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_123",
        amount: order.amount,
        currency: order.currency,
        name: "CollabyDraw",
        description: type === "pro_subscription" ? "Pro Subscription" : "100 AI Credits",
        order_id: order.id,
        handler: async function (response: any) {
          const verifyRes = await fetch("/api/billing/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...response,
              userId: session?.user?.id,
              type,
              credits: type === "ai_credits" ? "100" : "0",
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            router.push("/dashboard/billing?success=true");
            fetchUserData();
          } else {
            alert("Payment verification failed");
          }
        },
        prefill: {
          name: session?.user?.name || "",
          email: session?.user?.email || "",
        },
        theme: {
          color: "#7c3aed",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      console.error(e);
      alert(e.message || "An error occurred. Please try again.");
    }
    setCheckoutLoading(null);
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-[#06060c] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  const currentPlan = user?.plan || "FREE";
  const planColor = PLAN_COLORS[currentPlan as keyof typeof PLAN_COLORS] || "text-white/50 bg-white/10 border-white/20";
  const planDisplay = PLAN_DISPLAY[currentPlan as keyof typeof PLAN_DISPLAY] || "Free Plan";

  return (
    <div className="min-h-screen bg-[#06060c] text-white font-sans selection:bg-violet-500/30">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-[#06060c]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </Link>
            <h1 className="text-lg font-bold text-white tracking-tight">Billing & Plans</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full border text-xs font-semibold tracking-wide ${planColor}`}>
              {planDisplay}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* URL Params feedback (e.g. ?success=true) */}
        {typeof window !== "undefined" && window.location.search.includes("success=true") && (
          <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-400">Payment Successful</h3>
              <p className="text-xs text-emerald-400/80 mt-1">Your account has been updated successfully. Thank you for your purchase!</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Plan Overview */}
          <div className="md:col-span-2 space-y-6">
            <section className="p-6 rounded-3xl border border-white/10 bg-white/[0.02] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Crown className="w-32 h-32" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Current Subscription</h2>
              <p className="text-sm text-white/50 mb-6 max-w-md">
                You are currently on the {planDisplay}. Upgrade to Pro for unlimited boards and advanced AI features.
              </p>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="flex-1 p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-xs text-white/40 mb-1">Status</p>
                  <p className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active
                  </p>
                </div>
                <div className="flex-1 p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-xs text-white/40 mb-1">Billing Cycle</p>
                  <p className="text-sm font-medium text-white">-</p>
                </div>
              </div>

              {currentPlan !== "PRO" ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleStripeCheckout("pro_subscription")}
                    disabled={checkoutLoading !== null}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {checkoutLoading === "pro_subscription_stripe" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                    Upgrade with Stripe — $12/mo
                  </button>
                  <button
                    onClick={() => handleRazorpayCheckout("pro_subscription")}
                    disabled={checkoutLoading !== null}
                    className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {checkoutLoading === "pro_subscription_razorpay" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                    Upgrade with Razorpay — ₹999/mo
                  </button>
                </div>
              ) : (
                <button
                  disabled
                  className="px-6 py-2.5 rounded-xl bg-white/10 text-white/50 text-sm font-semibold cursor-not-allowed"
                >
                  Manage Subscription
                </button>
              )}
            </section>

            {/* Pricing Table */}
            <section>
              <h3 className="text-sm font-semibold text-white/70 mb-4 px-2 uppercase tracking-wider">Available Plans</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <h4 className="font-semibold text-white mb-1">Free</h4>
                  <p className="text-2xl font-bold text-white mb-4">$0<span className="text-sm font-normal text-white/40">/mo</span></p>
                  <ul className="space-y-2 mb-6">
                    <li className="text-xs text-white/70 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white/30"/> Up to 5 boards</li>
                    <li className="text-xs text-white/70 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white/30"/> 50 AI credits total</li>
                    <li className="text-xs text-white/70 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white/30"/> Basic shapes & text</li>
                  </ul>
                </div>
                <div className="p-5 rounded-2xl border border-violet-500/30 bg-violet-500/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-violet-500 text-[10px] font-bold uppercase tracking-wider text-white rounded-bl-lg">Popular</div>
                  <h4 className="font-semibold text-violet-400 mb-1">Pro</h4>
                  <p className="text-2xl font-bold text-white mb-4">$12<span className="text-sm font-normal text-white/40">/mo</span></p>
                  <ul className="space-y-2 mb-6">
                    <li className="text-xs text-white/90 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-violet-400"/> Unlimited boards</li>
                    <li className="text-xs text-white/90 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-violet-400"/> 500 AI credits / month</li>
                    <li className="text-xs text-white/90 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-violet-400"/> Folders & Organization</li>
                    <li className="text-xs text-white/90 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-violet-400"/> Priority support</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AI Credits Widget */}
            <section className="p-6 rounded-3xl border border-white/10 bg-gradient-to-b from-blue-900/20 to-transparent">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-sm font-semibold text-white mb-1">AI Credits</h2>
              <p className="text-3xl font-bold text-white mb-2">{user?.aiCredits || 0}</p>
              <p className="text-xs text-white/50 mb-6">Credits remaining for generative diagrams and auto-layout features.</p>
              
              <div className="space-y-2">
                <button
                  onClick={() => handleStripeCheckout("ai_credits")}
                  disabled={checkoutLoading !== null}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {checkoutLoading === "ai_credits_stripe" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                  Buy with Stripe — $5.00
                </button>
                <button
                  onClick={() => handleRazorpayCheckout("ai_credits")}
                  disabled={checkoutLoading !== null}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {checkoutLoading === "ai_credits_razorpay" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                  Buy with Razorpay — ₹499
                </button>
              </div>
            </section>

            {/* Referrals Widget */}
            <section className="p-6 rounded-3xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-sm font-semibold text-white mb-2">Refer a Friend</h2>
              <p className="text-xs text-white/50 mb-4">Get 50 free AI credits for every friend who signs up using your link.</p>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/50 border border-white/10">
                <code className="text-xs text-white/70 px-2 truncate flex-1">https://collabydraw.com/?ref={session?.user?.id?.substring(0, 8)}</code>
                <button className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
                  Copy
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
