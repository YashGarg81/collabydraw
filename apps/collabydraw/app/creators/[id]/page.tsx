import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Star, Package, Download } from "lucide-react";
import client from "@repo/db/client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creator = await client.user.findUnique({ where: { id } });
  if (!creator) return { title: "Creator Not Found" };
  return {
    title: `${creator.name || "Creator"} - Portfolio`,
  };
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const creator = await client.user.findUnique({
    where: { id },
    include: {
      templates: {
        where: { }, // All templates created by them
        orderBy: { downloads: "desc" }
      }
    }
  });

  if (!creator) {
    notFound();
  }

  const totalDownloads = creator.templates.reduce((acc, t) => acc + t.downloads, 0);

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <header className="border-b border-white/6 bg-[#080810]/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/templates" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </Link>
        </div>
      </header>

      {/* Profile Hero */}
      <div className="relative overflow-hidden border-b border-white/6 bg-gradient-to-b from-violet-600/5 to-transparent">
        <div className="max-w-5xl mx-auto px-6 py-16 flex flex-col sm:flex-row items-center gap-8">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-4xl sm:text-5xl font-bold text-white overflow-hidden shadow-2xl border-4 border-[#080810]">
            {creator.image ? (
              <img src={creator.image} alt={creator.name || "User"} className="w-full h-full object-cover" />
            ) : (
              creator.name?.charAt(0) || <User className="w-12 h-12" />
            )}
          </div>
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/60 mb-3">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              Verified Creator
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{creator.name || "Anonymous Creator"}</h1>
            {creator.referralCode && (
              <p className="text-sm text-white/40">Affiliate Code: <span className="font-mono text-violet-400">{creator.referralCode}</span></p>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{creator.templates.length}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider mt-1 flex items-center justify-center gap-1">
                <Package className="w-3 h-3" /> Templates
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalDownloads}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider mt-1 flex items-center justify-center gap-1">
                <Download className="w-3 h-3" /> Downloads
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template Portfolio */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span>Portfolio</span>
          <span className="text-xs font-medium bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
            {creator.templates.length}
          </span>
        </h2>

        {creator.templates.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>This creator hasn't published any templates yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creator.templates.map(t => (
              <Link key={t.id} href={`/templates/${t.id}`} className="group flex flex-col p-4 rounded-xl border border-white/8 bg-[#11111c] hover:border-violet-500/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-white/60 uppercase tracking-wider">{t.category}</span>
                  {t.isPaid ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 font-bold">${t.price.toFixed(2)}</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/60">FREE</span>
                  )}
                </div>
                <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors">{t.name}</h3>
                <p className="text-xs text-white/40 mt-1 line-clamp-2">{t.description}</p>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/30">
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {t.downloads}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
