import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { redirect } from "next/navigation";
import client from "@repo/db/client";
import { Users, DollarSign, Activity, CreditCard } from "lucide-react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, History, ShieldCheck } from "lucide-react";
import { AdminUserActions } from "./AdminUserActions";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/admin");
  }

  // Check admin role
  const currentUser = await client.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#06060c] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-white/50 max-w-md mx-auto">You do not have permission to view the admin dashboard.</p>
          <Link href="/dashboard" className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all inline-block text-sm font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Fetch metrics
  const totalUsers = await client.user.count();
  const totalProUsers = await client.user.count({ where: { plan: "PRO" } });
  
  // Calculate MRR based on PRO users. Assuming $12/mo
  const PRO_PRICE = 12;
  const estimatedMrr = totalProUsers * PRO_PRICE;

  const recentUsers = await client.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, email: true, plan: true, aiCredits: true, createdAt: true, isBanned: true },
  });

  const recentLogs = await client.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: { select: { email: true } } }
  });

  const activeSubscriptions = await client.subscription.count({
    where: { status: "active" },
  });

  return (
    <div className="min-h-screen bg-[#06060c] text-white font-sans">
      <nav className="sticky top-0 z-40 bg-[#06060c]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Link href="/dashboard" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </Link>
          <h1 className="text-lg font-bold text-white tracking-tight">Admin Dashboard</h1>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={<DollarSign className="w-5 h-5 text-emerald-400"/>} title="Estimated MRR" value={`$${estimatedMrr}`} bg="bg-emerald-500/10" border="border-emerald-500/20" />
          <MetricCard icon={<Users className="w-5 h-5 text-blue-400"/>} title="Total Users" value={totalUsers.toString()} bg="bg-blue-500/10" border="border-blue-500/20" />
          <MetricCard icon={<CreditCard className="w-5 h-5 text-violet-400"/>} title="Active Subscriptions" value={activeSubscriptions.toString()} bg="bg-violet-500/10" border="border-violet-500/20" />
          <MetricCard icon={<Activity className="w-5 h-5 text-orange-400"/>} title="Pro Conversion" value={`${((totalProUsers / (totalUsers || 1)) * 100).toFixed(1)}%`} bg="bg-orange-500/10" border="border-orange-500/20" />
        </div>

        {/* User List */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02] text-white/50 border-b border-white/5 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">AI Credits</th>
                  <th className="px-6 py-4 font-medium">Joined</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentUsers.map((u) => (
                  <tr key={u.id} className={`hover:bg-white/[0.02] transition-colors ${u.isBanned ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-2">
                        {u.name || "Anonymous"}
                        {u.id === session.user.id && <span className="text-[8px] bg-white/10 px-1 rounded text-white/40">YOU</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/60">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${u.plan === 'PRO' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-white/10 text-white/50 border border-white/10'}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/60">{u.aiCredits}</td>
                    <td className="px-6 py-4 text-white/60">{u.createdAt.toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${u.isBanned ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {u.isBanned ? 'BANNED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.id !== session.user.id && (
                        <AdminUserActions userId={u.id} isBanned={u.isBanned} />
                      )}
                    </td>
                  </tr>
                ))}
                {recentUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-white/40 text-xs">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Audit Logs */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-white/40" />
              Audit Logs
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-xs border-b border-white/5 pb-2 last:border-0">
                <div className="flex items-center gap-4">
                  <span className="text-white/40 w-32">{new Date(log.createdAt).toLocaleString()}</span>
                  <span className="font-mono text-violet-400">{log.action}</span>
                  <span className="text-white/60">by {log.user.email}</span>
                </div>
                <div className="text-white/30 truncate max-w-xs">{log.metadata}</div>
              </div>
            ))}
            {recentLogs.length === 0 && <p className="text-center text-white/30 py-4 text-xs">No audit logs found.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ icon, title, value, bg, border }: { icon: React.ReactNode, title: string, value: string, bg: string, border: string }) {
  return (
    <div className={`p-6 rounded-3xl border ${border} ${bg} backdrop-blur-sm`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">{title}</h3>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
