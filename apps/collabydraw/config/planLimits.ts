/**
 * Phase 3A: Plan Limits
 * Single source of truth for all plan-based feature gates.
 * Stripe will wire in plan changes later — enforcement is already here.
 */

export const PLAN_LIMITS = {
  FREE: {
    boards: 5,
    collaborators: 3,
    aiCreditsMonthly: 10,
    privateBoards: false,
    exportPNG: true,
  },
  PRO: {
    boards: Infinity,
    collaborators: 20,
    aiCreditsMonthly: 100,
    privateBoards: true,
    exportPNG: true,
  },
  ENTERPRISE: {
    boards: Infinity,
    collaborators: Infinity,
    aiCreditsMonthly: Infinity,
    privateBoards: true,
    exportPNG: true,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  const p = (plan?.toUpperCase() ?? "FREE") as Plan;
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.FREE;
}

export const PLAN_COLORS: Record<Plan, string> = {
  FREE:       "text-slate-400 bg-slate-400/10 border-slate-400/20",
  PRO:        "text-violet-400 bg-violet-400/10 border-violet-400/20",
  ENTERPRISE: "text-amber-400  bg-amber-400/10  border-amber-400/20",
};

export const PLAN_DISPLAY: Record<Plan, string> = {
  FREE:       "Free",
  PRO:        "Pro",
  ENTERPRISE: "Enterprise",
};
