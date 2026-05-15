import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { ArrowRight, Zap, Users, Lock, Cpu, Layers, GitBranch, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "CollabyDraw — AI-Powered Visual Workspace for Teams",
  description:
    "The collaborative whiteboard that goes beyond drawing. Real-time collaboration, AI diagram generation, end-to-end encryption, and a hand-drawn feel your team will love.",
  openGraph: {
    title: "CollabyDraw — AI-Powered Visual Workspace for Teams",
    description: "Collaborative whiteboard with AI superpowers. Draw, diagram, brainstorm — together.",
    url: "https://collabydraw.xyz",
  },
  alternates: { canonical: "https://collabydraw.xyz" },
};

const features = [
  {
    icon: Zap,
    title: "AI Diagram Generation",
    desc: "Type a prompt. Get a fully-laid-out diagram on your canvas in seconds — flowcharts, mindmaps, system designs.",
    gradient: "from-yellow-500/20 to-orange-500/20",
    iconColor: "text-yellow-400",
  },
  {
    icon: Users,
    title: "Real-Time Collaboration",
    desc: "See every stroke as it's drawn. Live cursors, shape streaming, and multi-tab awareness — zero lag.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: Lock,
    title: "End-to-End Encrypted",
    desc: "Your encryption key never touches our servers. The URL fragment stays client-side only.",
    gradient: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: Layers,
    title: "Rich Canvas Tools",
    desc: "Rectangles, ellipses, diamonds, free-draw, arrows, text, stickies, frames, embeds — all with sketch-style rendering.",
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: GitBranch,
    title: "Mermaid + AI Diagrams",
    desc: "Paste any Mermaid.js code or describe in plain English. Your diagram appears instantly on the infinite canvas.",
    gradient: "from-pink-500/20 to-rose-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: Cpu,
    title: "Infinite Canvas",
    desc: "Pan, zoom, group, align, snap to grid — a professional drawing experience that runs entirely in your browser.",
    gradient: "from-indigo-500/20 to-blue-500/20",
    iconColor: "text-indigo-400",
  },
];

const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for individuals and small projects.",
    features: ["3 boards", "Unlimited shapes", "50 AI credits / month", "Real-time collaboration", "Export PNG"],
    cta: "Start drawing",
    href: "/auth/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    desc: "For power users and growing teams.",
    features: ["Unlimited boards", "10 collaborators / board", "500 AI credits / month", "Export PNG + SVG + PDF", "Priority support"],
    cta: "Start free trial",
    href: "/auth/signup",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$49",
    period: "per month",
    desc: "For teams that need scale and security.",
    features: ["Unlimited everything", "SSO / SAML", "Audit logs", "SCIM provisioning", "Dedicated support", "Custom contracts"],
    cta: "Contact us",
    href: "mailto:hello@collabydraw.xyz",
    highlighted: false,
  },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="text-white">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[92vh] flex flex-col items-center justify-center px-4 text-center">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-violet-600/20 blur-[140px]" />
          <div className="absolute top-60 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-[120px]" />
          <div className="absolute top-60 -right-40 w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px]" />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Badge */}
        <div className="relative mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300 backdrop-blur-sm">
          <Zap className="w-3.5 h-3.5" />
          <span>Now with AI Diagram Generation</span>
        </div>

        {/* Headline */}
        <h1 className="relative max-w-4xl text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]">
          The Visual Workspace
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Built for Teams
          </span>
        </h1>

        <p className="relative mt-6 max-w-2xl text-lg sm:text-xl text-white/55 leading-relaxed">
          Collaborative whiteboard with a hand-drawn feel, real-time multiplayer,
          AI-powered diagrams, and end-to-end encryption — all in the browser.
        </p>

        <div className="relative mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href={session?.user ? "/dashboard" : "/auth/signup"}
            id="hero-cta-primary"
            className="group flex items-center gap-2 px-7 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-base transition-all shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5"
          >
            {session?.user ? "Go to Dashboard" : "Start drawing — it's free"}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/canvas"
            id="hero-cta-canvas"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-medium text-base transition-all backdrop-blur-sm"
          >
            Open canvas
          </Link>
        </div>

        {/* Social proof */}
        <div className="relative mt-12 flex items-center gap-6 text-sm text-white/35">
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span>Open source</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <span>No credit card required</span>
          <div className="w-px h-4 bg-white/10" />
          <span>Works offline</span>
        </div>
      </section>

      {/* ── Canvas Preview (inline SVG mockup) ── */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl shadow-black/60">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0f]/80 z-10 pointer-events-none" />
            <div className="bg-[#121218] min-h-[420px] flex items-center justify-center p-8">
              {/* Toolbar mockup */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1e1e28] border border-white/10 rounded-xl px-3 py-2">
                {["▢", "◯", "◇", "↗", "✏", "T", "🔍"].map((t, i) => (
                  <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${i === 0 ? "bg-violet-600/30 text-violet-300" : "text-white/40 hover:bg-white/5"}`}>
                    {t}
                  </div>
                ))}
              </div>
              {/* Canvas shapes mockup */}
              <svg viewBox="0 0 800 360" className="w-full max-w-3xl opacity-90">
                <rect x="40" y="80" width="160" height="80" rx="12" fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="none" />
                <text x="120" y="125" textAnchor="middle" fill="#c4b5fd" fontSize="14" fontFamily="sans-serif">User Request</text>

                <line x1="200" y1="120" x2="280" y2="120" stroke="#6d6d7a" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <rect x="280" y="80" width="160" height="80" rx="12" fill="none" stroke="#2563eb" strokeWidth="2" />
                <text x="360" y="125" textAnchor="middle" fill="#93c5fd" fontSize="14" fontFamily="sans-serif">API Gateway</text>

                <line x1="440" y1="120" x2="520" y2="120" stroke="#6d6d7a" strokeWidth="1.5" markerEnd="url(#arrow)" />

                <ellipse cx="600" cy="120" rx="80" ry="40" fill="none" stroke="#059669" strokeWidth="2" />
                <text x="600" y="125" textAnchor="middle" fill="#6ee7b7" fontSize="14" fontFamily="sans-serif">AI Engine</text>

                <rect x="160" y="220" width="200" height="70" rx="12" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="6,3" />
                <text x="260" y="260" textAnchor="middle" fill="#fcd34d" fontSize="13" fontFamily="sans-serif">Sticky Note 📌</text>

                <path d="M 460 220 L 500 255 L 540 220 L 500 185 Z" fill="none" stroke="#ec4899" strokeWidth="2" />
                <text x="500" y="260" textAnchor="middle" fill="#f9a8d4" fontSize="12" fontFamily="sans-serif">Decision?</text>

                <rect x="600" y="210" width="130" height="60" rx="8" fill="none" stroke="#6d6d7a" strokeWidth="1.5" />
                <text x="665" y="244" textAnchor="middle" fill="#9ca3af" fontSize="12" fontFamily="sans-serif">Frame 1</text>

                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M 0 0 L 6 3 L 0 6 Z" fill="#6d6d7a" />
                  </marker>
                </defs>

                {/* Cursor 1 */}
                <g transform="translate(310,170)">
                  <path d="M0 0 L0 16 L4 12 L7 18 L9 17 L6 11 L11 11Z" fill="#a78bfa" />
                  <rect x="14" y="14" width="52" height="18" rx="4" fill="#7c3aed" opacity="0.9" />
                  <text x="40" y="27" textAnchor="middle" fill="white" fontSize="9" fontFamily="sans-serif">Yash</text>
                </g>
                {/* Cursor 2 */}
                <g transform="translate(530,230)">
                  <path d="M0 0 L0 16 L4 12 L7 18 L9 17 L6 11 L11 11Z" fill="#34d399" />
                  <rect x="14" y="14" width="52" height="18" rx="4" fill="#059669" opacity="0.9" />
                  <text x="40" y="27" textAnchor="middle" fill="white" fontSize="9" fontFamily="sans-serif">Team</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything your team needs to think visually
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Powerful tools that stay out of the way until you need them.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`relative rounded-2xl border border-white/8 bg-gradient-to-br ${f.gradient} p-6 backdrop-blur-sm hover:border-white/15 transition-colors group`}
                >
                  <div className={`mb-4 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 ${f.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-white text-base mb-2">{f.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24 px-4" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, honest pricing</h2>
            <p className="text-white/50 text-lg">Start free. Upgrade when your team is ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl p-7 border transition-all ${
                  tier.highlighted
                    ? "border-violet-500/60 bg-gradient-to-b from-violet-600/20 to-violet-900/10 shadow-2xl shadow-violet-500/15"
                    : "border-white/8 bg-white/3"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-semibold shadow-lg">
                    Most Popular
                  </div>
                )}
                <div>
                  <div className="text-white/60 text-sm font-medium mb-2">{tier.name}</div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-4xl font-bold text-white">{tier.price}</span>
                    <span className="text-white/40 text-sm">/ {tier.period}</span>
                  </div>
                  <p className="text-white/45 text-sm mb-6">{tier.desc}</p>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-white/70">
                        <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto">
                  <Link
                    href={tier.href}
                    id={`pricing-cta-${tier.name.toLowerCase()}`}
                    className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                      tier.highlighted
                        ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                        : "border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/15 via-indigo-600/10 to-purple-600/15 p-12 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-violet-500/20 blur-[80px]" />
            </div>
            <h2 className="relative text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to think visually?
            </h2>
            <p className="relative text-white/55 text-lg mb-8">
              Join teams already drawing, diagramming, and collaborating on CollabyDraw.
            </p>
            <Link
              href={session?.user ? "/dashboard" : "/auth/signup"}
              id="bottom-cta"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-base transition-all shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5"
            >
              {session?.user ? "Open your dashboard" : "Get started for free"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
