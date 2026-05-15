"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Sparkles, Search, ArrowLeft, LayoutGrid, Loader2,
  ChevronRight, Star, Lock, Zap, CheckCircle2
} from "lucide-react";
import { TEMPLATE_CATEGORIES, type TemplateCategory } from "@/data/templates";

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  previewColor: string;
  shapeCount: number;
}

interface CategoryGroup {
  category: string;
  label: string;
  emoji: string;
  templates: TemplateMeta[];
}

// ── Mini canvas preview using shape count as an abstract illustration ──────────

function TemplatePreview({ color, shapeCount, emoji }: { color: string; shapeCount: number; emoji?: string }) {
  const circles = Array.from({ length: Math.min(shapeCount, 12) }, (_, i) => ({
    cx: 20 + (i % 4) * 50,
    cy: 20 + Math.floor(i / 4) * 40,
    r: 6 + (i % 3) * 3,
  }));
  return (
    <div className={`relative w-full h-36 rounded-xl bg-gradient-to-br ${color} overflow-hidden`}>
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%" viewBox="0 0 220 144" preserveAspectRatio="xMidYMid meet">
          {circles.map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="rgba(255,255,255,0.6)" />
          ))}
          {circles.slice(0, circles.length - 1).map((c, i) => (
            <line key={`l${i}`} x1={c.cx} y1={c.cy} x2={circles[i + 1]!.cx} y2={circles[i + 1]!.cy}
              stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          ))}
        </svg>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-5xl opacity-40 select-none">{emoji}</span>
      </div>
      <div className="absolute bottom-2 right-3 text-[10px] text-white/40 font-mono">
        {shapeCount} shapes
      </div>
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ t, onUse }: { t: TemplateMeta; onUse: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const catMeta = TEMPLATE_CATEGORIES[t.category as TemplateCategory];

  const handleUse = async () => {
    setLoading(true);
    await onUse(t.id);
    setDone(true);
    setLoading(false);
  };

  return (
    <div className="group flex flex-col rounded-2xl border border-white/8 bg-[#0d0d16] hover:border-violet-500/30 hover:bg-[#11111c] transition-all duration-300 overflow-hidden shadow-lg hover:shadow-violet-500/10">
      <TemplatePreview color={t.previewColor} shapeCount={t.shapeCount} emoji={catMeta?.emoji} />

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Category badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/12 border border-violet-500/20 text-violet-400 font-medium uppercase tracking-wider">
            {catMeta?.emoji} {catMeta?.label}
          </span>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white mb-1">{t.name}</h3>
          <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{t.description}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {t.tags.map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/30 border border-white/5">
              {tag}
            </span>
          ))}
        </div>

        {/* Action */}
        <button
          onClick={handleUse}
          disabled={loading || done}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all
            bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35
            disabled:opacity-60 disabled:cursor-not-allowed group-hover:scale-[1.01]"
        >
          {done ? (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Opening board…</>
          ) : loading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</>
          ) : (
            <><Zap className="w-3.5 h-3.5" /> Use Template</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then(r => r.json())
      .then(d => { setCategories(d.categories); setLoading(false); });
  }, []);

  const handleUseTemplate = useCallback(async (id: string) => {
    if (!session?.user) {
      router.push(`/auth/signin?callbackUrl=/templates`);
      return;
    }
    const res = await fetch(`/api/templates/${id}`, { method: "POST" });
    const data = await res.json();
    if (res.status === 403 && data.error === "PLAN_LIMIT") {
      setPlanError(data.message);
      return;
    }
    if (res.ok && data.board?.id) {
      router.push(`/canvas?board=${data.board.id}`);
    }
  }, [session, router]);

  // Filter templates
  const allTemplates = categories.flatMap(c => c.templates);
  const filtered = allTemplates.filter(t => {
    const matchCat = activeCategory === "all" || t.category === activeCategory;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/6 bg-[#080810]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <LayoutGrid className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white">Template Gallery</span>
          </div>
          <div className="flex-1" />
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-sm bg-white/5 border border-white/8 rounded-lg text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition"
              suppressHydrationWarning
            />
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/6">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-600/6 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 py-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/25 bg-violet-500/8 text-violet-400 text-xs font-medium mb-5">
            <Sparkles className="w-3 h-3" />
            {allTemplates.length} professionally crafted templates
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Start from a <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">template</span>
          </h1>
          <p className="text-white/45 text-base max-w-lg mx-auto">
            Jump-start your work with expert-designed boards. Pick a template, customise it, and collaborate instantly.
          </p>
        </div>
      </div>

      {/* Plan error */}
      {planError && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8 text-amber-400 text-sm">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{planError}</span>
            <button onClick={() => setPlanError(null)} className="text-amber-400/50 hover:text-amber-400">✕</button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              activeCategory === "all"
                ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                : "bg-white/3 border-white/8 text-white/50 hover:bg-white/6 hover:text-white/70"
            }`}
          >
            All ({allTemplates.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activeCategory === cat.category
                  ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                  : "bg-white/3 border-white/8 text-white/50 hover:bg-white/6 hover:text-white/70"
              }`}
            >
              {cat.emoji} {cat.label} ({cat.templates.length})
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      <main className="max-w-7xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Star className="w-10 h-10 text-white/15 mb-4" />
            <p className="text-white/40 text-sm">No templates match your search.</p>
          </div>
        ) : (
          <>
            {/* Show by category when no filter */}
            {activeCategory === "all" && !search ? (
              categories.map(cat => (
                cat.templates.length > 0 && (
                  <section key={cat.category} className="mb-12">
                    <div className="flex items-center gap-3 mb-5">
                      <h2 className="text-base font-semibold text-white flex items-center gap-2">
                        <span>{cat.emoji}</span> {cat.label}
                      </h2>
                      <span className="text-xs text-white/25">{cat.templates.length} templates</span>
                      <div className="flex-1 h-px bg-white/5" />
                      <button
                        onClick={() => setActiveCategory(cat.category)}
                        className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                      >
                        View all <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {cat.templates.map(t => (
                        <TemplateCard key={t.id} t={t} onUse={handleUseTemplate} />
                      ))}
                    </div>
                  </section>
                )
              ))
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(t => (
                  <TemplateCard key={t.id} t={t} onUse={handleUseTemplate} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
