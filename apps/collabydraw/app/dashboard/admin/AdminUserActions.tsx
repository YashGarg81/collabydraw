"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminUserActions({ userId, isBanned: initialIsBanned }: { userId: string, isBanned: boolean }) {
  const [loading, setLoading] = useState(false);
  const [isBanned, setIsBanned] = useState(initialIsBanned);
  const router = useRouter();

  const toggleBan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned: !isBanned }),
      });
      
      if (res.ok) {
        setIsBanned(!isBanned);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to toggle ban status", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleBan}
      disabled={loading}
      className={`p-2 rounded-xl transition-all ${
        isBanned 
          ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" 
          : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      }`}
      title={isBanned ? "Unban User" : "Ban User"}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isBanned ? (
        <ShieldCheck className="w-4 h-4" />
      ) : (
        <ShieldAlert className="w-4 h-4" />
      )}
    </button>
  );
}
