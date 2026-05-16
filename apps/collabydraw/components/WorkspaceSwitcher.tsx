"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Plus, Users, LayoutGrid, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
  _count?: { boards: number; members: number };
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces);
        // Default to personal space or first workspace
        if (data.workspaces.length > 0) setActiveWorkspace(data.workspaces[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-10 w-full animate-pulse bg-white/5 rounded-lg" />;

  return (
    <div className="relative mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {activeWorkspace?.name?.[0] || "P"}
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-white truncate max-w-[120px]">
              {activeWorkspace?.name || "Personal Space"}
            </div>
            <div className="text-[10px] text-white/40">
              {activeWorkspace?._count?.members || 1} members
            </div>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-white/20 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-14 left-0 z-50 w-full rounded-2xl border border-white/10 bg-[#13131a]/95 backdrop-blur-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/20 px-2 py-1 mb-1">
            Workspaces
          </div>
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { setActiveWorkspace(ws); setIsOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded-lg text-left transition-all",
                  activeWorkspace?.id === ws.id ? "bg-violet-600/20 text-violet-300" : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{ws.name}</span>
                </div>
                {activeWorkspace?.id === ws.id && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
          <div className="my-2 h-px bg-white/5" />
          <button className="w-full flex items-center gap-2 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 text-xs transition-all">
            <Plus className="w-3.5 h-3.5" />
            Create Workspace
          </button>
        </div>
      )}
    </div>
  );
}
