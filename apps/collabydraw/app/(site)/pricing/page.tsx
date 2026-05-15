import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing — CollabyDraw",
  description: "Simple, transparent pricing for individuals and teams. Start free, upgrade when ready.",
  alternates: { canonical: "https://collabydraw.xyz/pricing" },
};

const tiers = [
  {
    name: "Free",
    price: 0,
    period: "forever",
    desc: "For individuals exploring visual thinking.",
    features: [
      "3 boards",
      "Unlimited shapes per board",
      "50 AI credits / month",
      "Real-time collaboration (up to 3 users)",
      "Export PNG",
      "E2E encrypted rooms",
    ],
    notIncluded: ["SVG / PDF export", "Unlimited boards", "Priority support", "SSO / SAML"],
    cta: "Start for free",
    href: "/auth/signup",
    accent: "border-white/10",
    badge: null,
  },
  {
    name: "Pro",
    price: 12,
    period: "month",
    desc: "For power users and growing teams.",
    features: [
      "Unlimited boards",
      "Unlimited shapes",
      "500 AI credits / month",
      "10 collaborators per board",
      "Export PNG + SVG + PDF",
      "E2E encrypted rooms",
      "Priority support",
    ],
    notIncluded: ["SSO / SAML", "Audit logs", "SCIM provisioning"],
    cta: "Start 14-day free trial",
    href: "/auth/signup",
    accent: "border-violet-500/50",
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: 49,
    period: "month",
    desc: "For large teams with security requirements.",
    features: [
      "Everything in Pro",
      "Unlimited collaborators",
      "Unlimited AI credits",
      "SSO / SAML (Okta, Azure AD)",
      "SCIM provisioning",
      "Audit logs",
      "Custom contracts & SLA",
      "Dedicated support",
    ],
    notIncluded: [],
    cta: "Contact us",
    href: "mailto:hello@collabydraw.xyz",
    accent: "border-white/10",
    badge: null,
  },
];

const faqs = [
  { q: "Is the free plan really free?", a: "Yes — no credit card required, no time limit. You get 3 boards and 50 AI credits every month." },
  { q: "What counts as an AI credit?", a: "Each AI generation (diagram, mindmap, flowchart, etc.) uses 1–5 credits depending on complexity. Simple diagrams use 1 credit." },
  { q: "Can I cancel anytime?", a: "Absolutely. Cancel any time from your billing dashboard and you'll keep access until the end of your billing period." },
  { q: "What is E2E encryption?", a: "Your room's encryption key lives only in the URL fragment — it never reaches our servers. Even we cannot read your drawings." },
  { q: "Do you offer education discounts?", a: "Yes — students and teachers get Pro free. Email us with your .edu address and we'll set you up." },
];

export default function PricingPage() {
  return (
    <div className="text-white py-20 px-4">
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h1 className="text-5xl font-bold tracking-tight mb-4">Simple, honest pricing</h1>
        <p className="text-white/50 text-xl">Start free. Upgrade when your team needs more.</p>
      </div>

      {/* Tiers */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-24 items-stretch">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-2xl border p-8 ${tier.accent} ${
              tier.badge ? "bg-gradient-to-b from-violet-600/20 to-violet-900/10 shadow-2xl shadow-violet-500/10" : "bg-white/3"
            }`}
          >
            {tier.badge && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-bold shadow-md">
                {tier.badge}
              </div>
            )}
            <div className="mb-6">
              <div className="text-white/50 text-sm font-semibold uppercase tracking-widest mb-3">{tier.name}</div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-5xl font-extrabold">${tier.price}</span>
                {tier.price > 0 && <span className="text-white/40 text-sm ml-1">/ {tier.period}</span>}
              </div>
              <p className="text-white/45 text-sm">{tier.desc}</p>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
              {tier.notIncluded.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/25">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={tier.href}
              id={`pricing-${tier.name.toLowerCase()}`}
              className={`block text-center py-3.5 rounded-xl font-semibold text-sm transition-all ${
                tier.badge
                  ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
                  : "border border-white/10 bg-white/5 hover:bg-white/10 text-white"
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-10">Frequently asked questions</h2>
        <div className="space-y-5">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-white/8 bg-white/3 p-6">
              <h3 className="font-semibold text-white mb-2">{faq.q}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
