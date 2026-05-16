"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, CheckCircle2, Lock, CreditCard } from "lucide-react";

export function TemplateActions({ 
  templateId, 
  isPaid, 
  price, 
  hasPurchased,
  isLoggedIn 
}: { 
  templateId: string;
  isPaid: boolean;
  price: number;
  hasPurchased: boolean;
  isLoggedIn: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUse = async () => {
    if (!isLoggedIn) {
      router.push(`/auth/signin?callbackUrl=/templates/${templateId}`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}`, { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to use template");
      }

      setDone(true);
      router.push(`/canvas?board=${data.board.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!isLoggedIn) {
      router.push(`/auth/signin?callbackUrl=/templates/${templateId}`);
      return;
    }

    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/checkout`, { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Purchase failed");
      }

      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing(false);
    }
  };

  if (!isPaid || hasPurchased) {
    return (
      <div className="flex flex-col gap-3">
        {error && <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded">{error}</div>}
        <button
          onClick={handleUse}
          disabled={loading || done}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all
            bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35
            disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {done ? (
            <><CheckCircle2 className="w-4 h-4" /> Redirecting…</>
          ) : loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creating Board…</>
          ) : (
            <><Zap className="w-4 h-4" /> Use Template</>
          )}
        </button>
      </div>
    );
  }

  // Needs purchase
  return (
    <div className="flex flex-col gap-3">
      {error && <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded">{error}</div>}
      <button
        onClick={handlePurchase}
        disabled={purchasing}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all
          bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35
          disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {purchasing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
        ) : (
          <><CreditCard className="w-4 h-4" /> Buy for ${price.toFixed(2)}</>
        )}
      </button>
      <p className="text-[10px] text-white/30 text-center flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> Secure checkout powered by Stripe
      </p>
    </div>
  );
}
