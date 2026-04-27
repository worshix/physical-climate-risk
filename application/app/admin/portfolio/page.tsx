import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  Leaf, Users, DollarSign, TrendingDown, AlertTriangle,
  BarChart3, Activity, ChevronRight,
} from "lucide-react";

function ratingBadge(r: number) {
  const cls: Record<number, string> = {
    1: "bg-red-100 text-red-700",
    2: "bg-orange-100 text-orange-700",
    3: "bg-amber-100 text-amber-700",
    4: "bg-blue-100 text-blue-700",
    5: "bg-emerald-100 text-emerald-700",
  };
  const lbl: Record<number, string> = { 1: "Default", 2: "At Risk", 3: "Watch", 4: "Good", 5: "Excellent" };
  return (
    <Badge className={`${cls[r] ?? "bg-slate-100 text-slate-600"} border-none`}>
      {r} — {lbl[r] ?? "?"}
    </Badge>
  );
}

function gammaColor(g: number) {
  if (g < -1) return "text-red-600";
  if (g < 0) return "text-amber-600";
  return "text-emerald-600";
}

function BarChart({
  bars,
}: {
  bars: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex items-end gap-3 h-28 pt-2">
      {bars.map(({ label, value, color }) => {
        const pct = (value / max) * 100;
        return (
          <div key={label} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs font-bold text-slate-600">{value > 0 ? `$${value.toFixed(0)}` : "—"}</span>
            <div className="w-full rounded-t-sm" style={{ height: `${Math.max(pct, 3)}%`, backgroundColor: color }} />
            <span className="text-[10px] text-slate-400 text-center leading-tight">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function PortfolioPage() {
  const session = await getAdminSession();
  if (!session) redirect("/auth/login");

  const loans = await prisma.loan.findMany({
    where: { status: { not: "REPAID" } },
    include: {
      borrower: { select: { id: true, name: true, district: true } },
      eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });

  const active = loans.filter((l) => l.status === "ACTIVE");
  const defaults = loans.filter((l) => l.status === "DEFAULT");

  const totalEAD         = active.reduce((s, l) => s + l.loanAmount, 0);
  const totalECL1Year    = active.reduce((s, l) => s + (l.eclForecasts[0]?.ecl1Year ?? 0), 0);
  const totalECLExpected = active.reduce((s, l) => s + (l.eclForecasts[0]?.eclExpected ?? 0), 0);
  const provisioningRate = totalEAD > 0 ? (totalECL1Year / totalEAD) * 100 : 0;

  const scenarioTotals = {
    baseline:        active.reduce((s, l) => s + (l.eclForecasts[0]?.eclBaseline ?? 0), 0),
    moderateDrought: active.reduce((s, l) => s + (l.eclForecasts[0]?.eclModerateDrought ?? 0), 0),
    severeDrought:   active.reduce((s, l) => s + (l.eclForecasts[0]?.eclSevereDrought ?? 0), 0),
    wetRecovery:     active.reduce((s, l) => s + (l.eclForecasts[0]?.eclWetRecovery ?? 0), 0),
  };

  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const l of active) ratingDist[l.currentRating] = (ratingDist[l.currentRating] ?? 0) + 1;

  const normalCount = active.filter((l) => (l.eclForecasts[0]?.regimeWeight ?? 0) < 0.4).length;
  const stressCount = active.filter((l) => (l.eclForecasts[0]?.regimeWeight ?? 0) >= 0.4).length;
  const noECLCount  = active.filter((l) => l.eclForecasts.length === 0).length;

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
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Portfolio Risk Dashboard</h1>
          </div>
          <p className="text-slate-500 mt-1 ml-4">{active.length} active loans · IFRS 9 scenario analysis</p>
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
                Active Loans
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-slate-900">{active.length}</p>
              {defaults.length > 0 && (
                <p className="text-xs text-red-500 mt-0.5">{defaults.length} in default</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <DollarSign className="h-3 w-3 text-blue-600" />
                </div>
                Total EAD
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-slate-900">${totalEAD.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-400 to-indigo-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-md">
                  <TrendingDown className="h-3 w-3 text-indigo-600" />
                </div>
                1-Year ECL
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-slate-900">${totalECL1Year.toFixed(2)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{provisioningRate.toFixed(1)}% provisioning rate</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-md">
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                </div>
                Expected ECL
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-red-700">${totalECLExpected.toFixed(2)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Probability-weighted</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Scenario ECL Chart */}
          <Card className="border-0 shadow-sm md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-md">
                  <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                Portfolio ECL by Scenario (1-Year)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No active loans with ECL data.</p>
              ) : (
                <>
                  <BarChart
                    bars={[
                      { label: "Wet Recovery (8%)",     value: scenarioTotals.wetRecovery,     color: "#10b981" },
                      { label: "Baseline (55%)",         value: scenarioTotals.baseline,        color: "#3b82f6" },
                      { label: "Moderate Drought (25%)", value: scenarioTotals.moderateDrought, color: "#f59e0b" },
                      { label: "Severe Drought (12%)",   value: scenarioTotals.severeDrought,   color: "#ef4444" },
                    ]}
                  />
                  <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                    {[
                      { label: "Baseline",         val: scenarioTotals.baseline,        pct: "55%", color: "text-blue-600",    bg: "bg-blue-50" },
                      { label: "Moderate Drought", val: scenarioTotals.moderateDrought, pct: "25%", color: "text-amber-600",   bg: "bg-amber-50" },
                      { label: "Severe Drought",   val: scenarioTotals.severeDrought,   pct: "12%", color: "text-red-600",     bg: "bg-red-50" },
                      { label: "Wet Recovery",     val: scenarioTotals.wetRecovery,     pct: "8%",  color: "text-emerald-600", bg: "bg-emerald-50" },
                    ].map(({ label, val, pct, color, bg }) => (
                      <div key={label} className={`rounded-lg ${bg} p-2`}>
                        <p className={`font-bold ${color}`}>${val.toFixed(2)}</p>
                        <p className="text-slate-500">{label}</p>
                        <p className="text-slate-400">{pct}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Regime Breakdown + Rating Distribution */}
          <div className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-md">
                    <Activity className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  Regime Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {active.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No active loans.</p>
                ) : (
                  <>
                    <RegimeBar label="Normal / Wet"   count={normalCount} total={active.length} color="bg-emerald-500" />
                    <RegimeBar label="Drought Stress" count={stressCount} total={active.length} color="bg-red-500" />
                    {noECLCount > 0 && (
                      <RegimeBar label="No ECL data"  count={noECLCount}  total={active.length} color="bg-slate-300" />
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-md">
                    <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  Rating Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {([5, 4, 3, 2, 1] as const).map((r) => {
                  const count = ratingDist[r] ?? 0;
                  const pct = active.length > 0 ? (count / active.length) * 100 : 0;
                  const colors: Record<number, string> = {
                    5: "bg-emerald-500", 4: "bg-blue-500", 3: "bg-amber-400", 2: "bg-orange-500", 1: "bg-red-500",
                  };
                  return (
                    <div key={r} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-slate-500 shrink-0">Rating {r}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[r]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-5 text-right font-medium text-slate-600">{count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Loan Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 rounded-md">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              Active Loan Book
            </CardTitle>
          </CardHeader>
          {active.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-400 italic py-4">No active loans.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Borrower", "District", "Loan Ref", "Rating", "EAD ($)", "γ", "ω(γ)", "1Q PD", "1-Yr ECL", "Expected ECL", "Stage", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((l) => {
                    const ecl = l.eclForecasts[0] ?? null;
                    return (
                      <tr key={l.id} className="border-b border-slate-50 hover:bg-emerald-50/40 transition-colors">
                        <td className="px-6 py-3 font-semibold text-slate-900">{l.borrower.name}</td>
                        <td className="px-4 py-3 text-slate-500">{l.borrower.district ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{l.loanRef}</td>
                        <td className="px-4 py-3">{ratingBadge(l.currentRating)}</td>
                        <td className="px-4 py-3 text-right font-medium">{l.loanAmount.toLocaleString()}</td>
                        <td className={`px-4 py-3 font-mono text-xs ${ecl ? gammaColor(ecl.currentGamma) : "text-slate-300"}`}>
                          {ecl ? ecl.currentGamma.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {ecl ? ecl.regimeWeight.toFixed(3) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {ecl ? `${(ecl.onePeriodPD * 100).toFixed(1)}%` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">
                          {ecl ? `$${ecl.ecl1Year.toFixed(2)}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-700">
                          {ecl ? `$${ecl.eclExpected.toFixed(2)}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs font-mono">{l.stage.replace("_", " ")}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/borrowers/${l.borrower.id}`}>
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

function RegimeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-700">{count} <span className="text-slate-400">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
