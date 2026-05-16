import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Download, Lock, CheckCircle2, LayoutGrid } from "lucide-react";
import client from "@repo/db/client";
import { TEMPLATE_CATEGORIES, type TemplateCategory } from "@/data/templates";
import { TemplateActions } from "@/components/TemplateActions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await client.template.findUnique({ where: { id } });
  if (!template) return { title: "Template Not Found" };
  return {
    title: `${template.name} - CollabyDraw Templates`,
    description: template.description,
  };
}

export default async function TemplateDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  
  const template = await client.template.findUnique({
    where: { id },
    include: {
      author: true,
    }
  });

  if (!template) {
    notFound();
  }

  const catMeta = TEMPLATE_CATEGORIES[template.category as TemplateCategory];
  
  let shapeCount = 0;
  try {
    shapeCount = JSON.parse(template.shapes).length;
  } catch(e) {}

  let hasPurchased = false;
  if (session?.user && template.isPaid && template.authorId !== session.user.id) {
    const purchase = await client.templatePurchase.findUnique({
      where: { templateId_userId: { templateId: id, userId: session.user.id } }
    });
    hasPurchased = !!purchase;
  }

  const isAuthor = session?.user?.id === template.authorId;

  return (
    <div className="min-h-screen bg-[#080810] text-white selection:bg-violet-500/30">
      {/* Header */}
      <header className="border-b border-white/6 bg-[#080810]/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/templates" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Templates
          </Link>
          <div className="flex-1" />
          <Link href="/dashboard" className="text-sm text-violet-400 hover:text-violet-300 font-medium">
            Go to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/12 border border-violet-500/20 text-violet-400 font-medium uppercase tracking-wider">
                  {catMeta?.emoji || "📄"} {catMeta?.label || template.category}
                </span>
                {template.isPaid ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-400 font-bold tracking-wider">
                    ${template.price.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 font-medium tracking-wider">
                    FREE
                  </span>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                {template.name}
              </h1>
              <p className="text-lg text-white/50 leading-relaxed max-w-2xl">
                {template.description}
              </p>
            </div>

            {/* Visual Preview */}
            <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/10 border border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 opacity-20">
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0 100 Q 25 50 50 100 T 100 100 L 100 0 L 0 0 Z" fill="rgba(139,92,246,0.3)" />
                </svg>
              </div>
              <LayoutGrid className="w-24 h-24 text-white/10" />
              <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-mono text-white/70">{shapeCount} elements</span>
              </div>
            </div>
            
            {/* SEO Content / Details */}
            <div className="prose prose-invert max-w-none">
              <h3 className="text-xl font-semibold text-white">About this template</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Start your next project instantly with this pre-designed {template.name} template. 
                Whether you're brainstorming, planning a sprint, or architecting a complex system, 
                this template provides the perfect foundation.
              </p>
            </div>
          </div>

          {/* Sidebar (Right) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 p-6 rounded-2xl border border-white/8 bg-[#11111c] shadow-xl flex flex-col gap-6">
              
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-lg font-bold text-white overflow-hidden shadow-lg">
                  {template.author?.image ? (
                    <img src={template.author.image} alt={template.author.name || "A"} className="w-full h-full object-cover" />
                  ) : (
                    template.author?.name?.charAt(0) || "A"
                  )}
                </div>
                <div>
                  <div className="text-xs text-white/40 mb-0.5">Created by</div>
                  <Link href={`/creators/${template.authorId}`} className="text-sm font-medium text-white hover:text-violet-400 transition-colors">
                    {template.author?.name || "Anonymous Creator"}
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-6">
                <div>
                  <div className="text-xs text-white/40 mb-1">Downloads</div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Download className="w-4 h-4 text-white/30" />
                    {template.downloads}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40 mb-1">Price</div>
                  <div className="flex items-center gap-1.5 font-medium">
                    {template.isPaid ? `$${template.price.toFixed(2)}` : "Free"}
                  </div>
                </div>
              </div>

              <TemplateActions 
                templateId={template.id} 
                isPaid={template.isPaid} 
                price={template.price}
                hasPurchased={hasPurchased || isAuthor}
                isLoggedIn={!!session?.user}
              />
              
              {!session?.user && (
                <p className="text-[10px] text-center text-white/30">
                  You need to <Link href="/auth/signin" className="underline hover:text-white/60">sign in</Link> to use templates.
                </p>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
