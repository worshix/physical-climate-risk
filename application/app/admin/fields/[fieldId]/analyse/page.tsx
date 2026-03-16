import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  ArrowLeft, Leaf, Activity, TrendingDown,
  Droplets, Thermometer, BarChart3, AlertTriangle,
} from "lucide-react";

function scoreBadge(score: number) {
  if (score >= 65) return <Badge className="bg-emerald-100 text-emerald-700 border-none">Healthy ({score}/100)</Badge>;
  if (score >= 40) return <Badge className="bg-amber-100 text-amber-700 border-none">Moderate Stress ({score}/100)</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-none">High Stress ({score}/100)</Badge>;
}

function gammaColor(gamma: number) {
  if (gamma < -1.5) return "text-red-600";
  if (gamma < 0) return "text-amber-600";
  return "text-emerald-600";
}

export default async function FieldViewPage({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/auth/login");

  const { fieldId } = await params;

  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: {
      borrower: { select: { id: true, name: true, district: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!field) notFound();

  const analysis = field.analyses[0] ?? null;

  // Latest ECL for the borrower's active loan
  const loan = await prisma.loan.findFirst({
    where: { borrowerId: field.borrowerId, status: { not: "REPAID" } },
    include: { eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  const ecl = loan?.eclForecasts[0] ?? null;

  let recs: string[] = [];
  if (analysis?.recommendations) {
    try { recs = JSON.parse(analysis.recommendations); } catch { /* ignore */ }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href={`/admin/borrowers/${field.borrower.id}`}>
            <Button variant="ghost" size="icon" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900">{field.name}</span>
            <span className="text-sm text-slate-400 ml-2">— {field.borrower.name}</span>
          </div>
        </div>
        <LogoutButton />
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full space-y-6">
        {!analysis ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
            <Activity className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-600">No analysis yet</p>
            <p className="text-sm mt-1 text-slate-400">
              This farmer hasn&apos;t run a field analysis. They can do so from their dashboard.
            </p>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Agri Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">
                    {Math.round(analysis.agriculturalScore)}<span className="text-sm text-slate-400">/100</span>
                  </p>
                  <div className="mt-1">{scoreBadge(analysis.agriculturalScore)}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" /> SPEI-3 (γ)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold font-mono ${gammaColor(analysis.gamma)}`}>
                    {analysis.gamma.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">ω = {analysis.regimeWeight.toFixed(3)}</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5" /> Rainfall (14d)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">
                    {analysis.totalRainfall.toFixed(0)}<span className="text-sm text-slate-400">mm</span>
                  </p>
                  {analysis.waterStressRisk && (
                    <Badge className="bg-red-100 text-red-700 border-none text-xs mt-1">Water Stress</Badge>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Thermometer className="h-3.5 w-3.5" /> Avg Temp
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">
                    {analysis.avgTemperature.toFixed(1)}<span className="text-sm text-slate-400">°C</span>
                  </p>
                  {analysis.diseaseRisk && (
                    <Badge className="bg-amber-100 text-amber-700 border-none text-xs mt-1">Disease Risk</Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Vegetation detail */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" /> Vegetation Signal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mean NDVI</span>
                    <span className="font-mono font-semibold">{analysis.meanNDVI.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">NDVI Trend</span>
                    <Badge variant="outline" className="text-xs">{analysis.ndviTrend}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Health Status</span>
                    <Badge variant="outline" className="text-xs">{analysis.healthStatus.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 pt-2">
                    Analysed {new Date(analysis.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              {/* ECL summary */}
              {ecl ? (
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-emerald-600" /> ECL Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">1Q Probability of Default</span>
                      <span className="font-mono text-orange-600">{(ecl.onePeriodPD * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">1-Year ECL</span>
                      <span className="font-bold text-red-600">${ecl.ecl1Year.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">5-Year ECL</span>
                      <span className="font-bold text-red-700">${ecl.ecl5Year.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
                      <p className="font-bold text-slate-500 uppercase tracking-wider mb-1">IFRS 9 Scenarios</p>
                      {[
                        { label: "Baseline (55%)",           val: ecl.eclBaseline },
                        { label: "Moderate Drought (25%)",   val: ecl.eclModerateDrought },
                        { label: "Severe Drought (12%)",     val: ecl.eclSevereDrought },
                        { label: "Wet Recovery (8%)",        val: ecl.eclWetRecovery },
                        { label: "Expected ECL",             val: ecl.eclExpected, bold: true },
                      ].map(({ label, val, bold }) => (
                        <div key={label} className="flex justify-between">
                          <span className={bold ? "font-bold text-slate-700" : "text-slate-500"}>{label}</span>
                          <span className={bold ? "font-bold text-red-700" : "font-mono"}>${val.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-slate-200 flex items-center justify-center p-8">
                  <p className="text-sm text-slate-400 italic">No active loan — ECL not computed.</p>
                </Card>
              )}
            </div>

            {/* Recommendations */}
            {recs.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Agronomic Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {recs.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
