import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  Leaf, Users, Activity, ChevronRight, CloudSun,
  AlertTriangle, Droplets, Thermometer,
} from "lucide-react";

function gammaColor(g: number) {
  if (g < -1.5) return "text-red-600";
  if (g < -1.0) return "text-orange-600";
  if (g < 0)    return "text-amber-600";
  return "text-emerald-600";
}

function speiLabel(gamma: number): { label: string; color: string } {
  if (gamma >= 1.0)  return { label: "Wet",              color: "bg-blue-100 text-blue-700" };
  if (gamma >= 0.0)  return { label: "Normal",           color: "bg-emerald-100 text-emerald-700" };
  if (gamma >= -1.0) return { label: "Mildly Dry",       color: "bg-yellow-100 text-yellow-700" };
  if (gamma >= -1.5) return { label: "Moderate Drought", color: "bg-amber-100 text-amber-700" };
  return               { label: "Severe Drought",        color: "bg-red-100 text-red-700" };
}

function RegimeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-700">
          {count} <span className="text-slate-400">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function PortfolioPage() {
  const session = await getAdminSession();
  if (!session) redirect("/auth/login");

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

  const withAnalysis   = borrowers.filter((b) => (b.fields[0]?.analyses.length ?? 0) > 0);
  const withField      = borrowers.filter((b) => b.fields.length > 0).length;
  const wetNormal      = withAnalysis.filter((b) => (b.fields[0]?.analyses[0]?.gamma ?? 0) >= 0).length;
  const mildlyDry      = withAnalysis.filter((b) => { const g = b.fields[0]?.analyses[0]?.gamma ?? 0; return g < 0 && g >= -1.0; }).length;
  const moderateDrought = withAnalysis.filter((b) => { const g = b.fields[0]?.analyses[0]?.gamma ?? 0; return g < -1.0 && g >= -1.5; }).length;
  const severeDrought  = withAnalysis.filter((b) => (b.fields[0]?.analyses[0]?.gamma ?? 0) < -1.5).length;

  const avgGamma = withAnalysis.length > 0
    ? withAnalysis.reduce((s, b) => s + (b.fields[0]?.analyses[0]?.gamma ?? 0), 0) / withAnalysis.length
    : null;

  const avgNDVI = withAnalysis.length > 0
    ? withAnalysis.reduce((s, b) => s + (b.fields[0]?.analyses[0]?.meanNDVI ?? 0), 0) / withAnalysis.length
    : null;

  const waterStressCount = withAnalysis.filter((b) => b.fields[0]?.analyses[0]?.waterStressRisk).length;
  const diseaseRiskCount = withAnalysis.filter((b) => b.fields[0]?.analyses[0]?.diseaseRisk).length;

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
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-emerald-700 hover:bg-emerald-50">
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/portfolio">
            <Button variant="ghost" size="sm" className="text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100">
              Portfolio
            </Button>
          </Link>
          <div className="h-5 w-px bg-slate-200 mx-2" />
          <LogoutButton />
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full" />
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Climate Portfolio Overview</h1>
          </div>
          <p className="text-slate-500 mt-1 ml-4">
            {borrowers.length} registered borrowers · {withAnalysis.length} with satellite analysis
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <p className="text-xs text-slate-400 mt-0.5">{withField} with field registered</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <CloudSun className="h-3 w-3 text-blue-600" />
                </div>
                Avg SPEI-3
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className={`text-3xl font-bold font-mono ${avgGamma !== null ? gammaColor(avgGamma) : "text-slate-300"}`}>
                {avgGamma !== null ? avgGamma.toFixed(2) : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Portfolio drought index</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-teal-400 to-teal-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-teal-100 rounded-md">
                  <Activity className="h-3 w-3 text-teal-600" />
                </div>
                Avg NDVI
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold font-mono text-slate-900">
                {avgNDVI !== null ? avgNDVI.toFixed(3) : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Mean vegetation index</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-md">
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                </div>
                Risk Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-red-600">{waterStressCount + diseaseRiskCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">{waterStressCount} water · {diseaseRiskCount} disease</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* SPEI Distribution */}
          <Card className="border-0 shadow-sm md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <CloudSun className="h-3.5 w-3.5 text-blue-600" />
                </div>
                SPEI-3 Drought Regime Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {withAnalysis.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No borrowers with field analysis yet.</p>
              ) : (
                <div className="space-y-3">
                  <RegimeBar label="Wet / Normal (γ ≥ 0)"          count={wetNormal}       total={withAnalysis.length} color="bg-emerald-500" />
                  <RegimeBar label="Mildly Dry (−1.0 ≤ γ < 0)"     count={mildlyDry}       total={withAnalysis.length} color="bg-yellow-400" />
                  <RegimeBar label="Moderate Drought (−1.5 ≤ γ < −1.0)" count={moderateDrought} total={withAnalysis.length} color="bg-amber-500" />
                  <RegimeBar label="Severe Drought (γ < −1.5)"     count={severeDrought}   total={withAnalysis.length} color="bg-red-500" />
                  <p className="text-xs text-slate-400 pt-2">
                    Based on {withAnalysis.length} borrowers with satellite analysis out of {borrowers.length} total.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Summary */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-md">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                </div>
                Agricultural Risk Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-100 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-slate-700 font-medium">Water Stress</span>
                  <span className="ml-auto font-bold text-red-600">{waterStressCount}</span>
                </div>
                <p className="text-xs text-slate-400">Borrowers with moisture deficit flagged</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Thermometer className="h-4 w-4 text-orange-500" />
                  <span className="text-slate-700 font-medium">Disease Risk</span>
                  <span className="ml-auto font-bold text-amber-700">{diseaseRiskCount}</span>
                </div>
                <p className="text-xs text-slate-400">Borrowers with temperature anomaly</p>
              </div>
              {withAnalysis.length === 0 && (
                <p className="text-xs text-slate-400 italic">No analysis data available yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Borrower Climate Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 rounded-md">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              Borrower Climate Signals
            </CardTitle>
          </CardHeader>
          {borrowers.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-400 italic py-4">No borrowers registered.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Borrower", "District", "Field", "SPEI-3 (γ)", "Climate Status", "NDVI", "Rainfall (14d)", "Temp (°C)", "Flags", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {borrowers.map((b) => {
                    const analysis = b.fields[0]?.analyses[0] ?? null;
                    const spei = analysis ? speiLabel(analysis.gamma) : null;
                    return (
                      <tr key={b.id} className="border-b border-slate-50 hover:bg-emerald-50/40 transition-colors">
                        <td className="px-6 py-3 font-semibold text-slate-900">{b.name}</td>
                        <td className="px-4 py-3 text-slate-500">{b.district ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{b.fields[0]?.name ?? <span className="text-slate-300">No field</span>}</td>
                        <td className={`px-4 py-3 font-mono text-sm ${analysis ? gammaColor(analysis.gamma) : "text-slate-300"}`}>
                          {analysis ? analysis.gamma.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {spei ? (
                            <Badge className={`${spei.color} border-none text-xs`}>{spei.label}</Badge>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {analysis ? analysis.meanNDVI.toFixed(3) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {analysis ? `${analysis.totalRainfall.toFixed(0)} mm` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {analysis ? `${analysis.avgTemperature.toFixed(1)}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {analysis?.waterStressRisk && (
                              <Badge className="bg-blue-100 text-blue-700 border-none text-[10px] px-1.5">Water</Badge>
                            )}
                            {analysis?.diseaseRisk && (
                              <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] px-1.5">Disease</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
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
          )}
        </Card>
      </main>
    </div>
  );
}
