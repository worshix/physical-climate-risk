import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  Leaf, Plus, Users, Activity, ChevronRight,
  CloudSun, AlertTriangle, CheckCircle2,
} from "lucide-react";

function speiLabel(gamma: number): { label: string; color: string } {
  if (gamma >= 1.0)  return { label: "Wet",             color: "bg-blue-100 text-blue-700" };
  if (gamma >= 0.0)  return { label: "Normal",          color: "bg-emerald-100 text-emerald-700" };
  if (gamma >= -1.0) return { label: "Mildly Dry",      color: "bg-yellow-100 text-yellow-700" };
  if (gamma >= -1.5) return { label: "Moderate Drought", color: "bg-amber-100 text-amber-700" };
  return               { label: "Severe Drought",       color: "bg-red-100 text-red-700" };
}

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/auth/login");

  const admin = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });

  const borrowers = await prisma.user.findMany({
    where: { role: "BORROWER" },
    include: {
      fields: {
        include: {
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const withField    = borrowers.filter((b) => b.fields.length > 0).length;
  const withAnalysis = borrowers.filter((b) => (b.fields[0]?.analyses.length ?? 0) > 0).length;
  const inDrought    = borrowers.filter((b) => (b.fields[0]?.analyses[0]?.gamma ?? 1) < -1.0).length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-1.5 rounded-lg shadow-sm">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">Mitiga Global Analytics Engine</span>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">ADMIN</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100">
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/portfolio">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-emerald-700 hover:bg-emerald-50">
              Portfolio
            </Button>
          </Link>
          <div className="h-5 w-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {admin?.name?.charAt(0) ?? "A"}
            </div>
            <span className="text-xs font-medium text-slate-700">{admin?.name ?? "Admin"}</span>
          </div>
          <LogoutButton />
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-8 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" />
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Borrower Overview</h1>
            </div>
            <p className="text-slate-500 mt-1 ml-4">
              {borrowers.length} registered borrowers · {withAnalysis} with field analysis
            </p>
          </div>
          <Link href="/admin/borrowers/new">
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white gap-2 h-11 px-6 shadow-md">
              <Plus className="h-4 w-4" /> Register Borrower
            </Button>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-md">
                  <Users className="h-3 w-3 text-emerald-600" />
                </div>
                Borrowers
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-slate-900">{borrowers.length}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-teal-100 rounded-md">
                  <Activity className="h-3 w-3 text-teal-600" />
                </div>
                With Field
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-slate-900">{withField}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                </div>
                Analysed
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-slate-900">{withAnalysis}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-md">
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                </div>
                Drought Stress
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-red-600">{inDrought}</p>
              <p className="text-xs text-slate-400 mt-0.5">SPEI &lt; −1.0</p>
            </CardContent>
          </Card>
        </div>

        {/* Borrower List */}
        {borrowers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-100 text-center">
            <div className="bg-white p-6 rounded-full mb-6 shadow-md">
              <Users className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No borrowers yet</h2>
            <p className="text-slate-500 mb-8 max-w-sm">
              Register your first borrower to begin tracking their farm health and climate risk.
            </p>
            <Link href="/admin/borrowers/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-8 text-lg font-semibold rounded-xl shadow-md">
                Register First Borrower
              </Button>
            </Link>
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-md">
                  <Users className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Registered Borrowers
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Borrower</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">District</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Activity</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Field</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">SPEI-3</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Climate Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Analysed</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {borrowers.map((b) => {
                    const analysis = b.fields[0]?.analyses[0] ?? null;
                    const spei = analysis ? speiLabel(analysis.gamma) : null;
                    return (
                      <tr key={b.id} className="border-b border-slate-50 hover:bg-emerald-50/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">{b.name}</td>
                        <td className="px-4 py-4 text-slate-500">{b.district ?? "—"}</td>
                        <td className="px-4 py-4 text-slate-500 text-xs">{b.primaryActivity ?? "—"}</td>
                        <td className="px-4 py-4">
                          {b.fields.length > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-none text-xs">
                              <Activity className="h-3 w-3 mr-1" /> {b.fields[0].name}
                            </Badge>
                          ) : (
                            <span className="text-slate-300 text-xs">No field</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {analysis ? (
                            <span className={`font-mono text-sm font-semibold ${analysis.gamma < -1 ? "text-red-600" : analysis.gamma < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                              {analysis.gamma.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {spei ? (
                            <Badge className={`${spei.color} border-none text-xs`}>
                              <CloudSun className="h-3 w-3 mr-1" /> {spei.label}
                            </Badge>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {analysis ? new Date(analysis.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-4">
                          <Link href={`/admin/borrowers/${b.id}`}>
                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-700 hover:bg-emerald-50">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
