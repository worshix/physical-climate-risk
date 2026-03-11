import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBorrowerSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  Leaf, CreditCard, Activity, CloudSun, FileText,
  TrendingDown, Droplets, Thermometer,
} from "lucide-react";

// ── Friendly language for borrowers (no raw model values) ────────────────────

function climateLabel(omega: number): { label: string; color: string; description: string } {
  if (omega >= 0.7) return {
    label: "Drought Stress",
    color: "bg-red-100 text-red-700",
    description: "Your region is experiencing significant drought conditions. This may affect crop yields and loan repayment capacity.",
  };
  if (omega >= 0.4) return {
    label: "Moderate Dry Spell",
    color: "bg-amber-100 text-amber-700",
    description: "Some dry-spell stress is present in your region. Monitor your field conditions closely.",
  };
  if (omega >= 0.2) return {
    label: "Slightly Dry",
    color: "bg-yellow-100 text-yellow-700",
    description: "Conditions are slightly drier than normal but manageable.",
  };
  return {
    label: "Good Conditions",
    color: "bg-emerald-100 text-emerald-700",
    description: "Weather and climate conditions in your region are favourable for agriculture.",
  };
}

function ratingLabel(r: number) {
  return { 1: "Critical", 2: "Needs Attention", 3: "Satisfactory", 4: "Good", 5: "Excellent" }[r] ?? "Unknown";
}

function ratingColor(r: number) {
  if (r === 1) return "bg-red-100 text-red-700";
  if (r === 2) return "bg-orange-100 text-orange-700";
  if (r === 3) return "bg-amber-100 text-amber-700";
  if (r === 4) return "bg-blue-100 text-blue-700";
  return "bg-emerald-100 text-emerald-700";
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 25) return "Moderate Concern";
  return "Needs Attention";
}

export default async function BorrowerDashboardPage() {
  const session = await getBorrowerSession();
  if (!session) redirect("/auth/login");

  const borrower = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      loans: {
        where: { status: { not: "REPAID" } },
        include: {
          eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      fields: {
        include: {
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        take: 1,
      },
    },
  });

  if (!borrower) redirect("/auth/login");

  const loan = borrower.loans[0] ?? null;
  const ecl  = loan?.eclForecasts[0] ?? null;
  const analysis = borrower.fields[0]?.analyses[0] ?? null;

  const climate = ecl ? climateLabel(ecl.regimeWeight) : null;

  let recs: string[] = [];
  if (analysis?.recommendations) {
    try { recs = JSON.parse(analysis.recommendations); } catch { /* ignore */ }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">AgriFin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/borrower/report">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="h-4 w-4" /> My Report
            </Button>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
            <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {borrower.name.charAt(0)}
            </div>
            <span className="text-xs font-medium text-slate-700">{borrower.name}</span>
          </div>
          <LogoutButton />
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {borrower.name.split(" ")[0]}</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {borrower.district ? `${borrower.district} · ` : ""}{borrower.primaryActivity ?? "AgriFin Borrower"}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── My Loan ── */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" /> My Loan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loan ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Loan Reference</span>
                    <span className="font-mono text-sm font-semibold">{loan.loanRef}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Credit Standing</span>
                    <Badge className={`${ratingColor(loan.currentRating)} border-none`}>
                      {ratingLabel(loan.currentRating)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Outstanding Balance</span>
                    <span className="font-bold text-slate-900">${loan.loanAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Loan Status</span>
                    <Badge variant={loan.status === "DEFAULT" ? "destructive" : "secondary"} className="text-xs">
                      {loan.status}
                    </Badge>
                  </div>
                  {ecl && (
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estimated Credit Exposure</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">12-Month Estimate</span>
                        <span className="font-bold text-red-600">${ecl.ecl1Year.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        This figure represents an estimate of potential credit loss under current climate conditions. It is used for IFRS 9 provisioning only.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">No active loan on file. Contact your credit officer.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Climate Conditions ── */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CloudSun className="h-4 w-4 text-emerald-600" /> Climate Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {climate ? (
                <>
                  <div className="flex items-center gap-3">
                    <Badge className={`${climate.color} border-none text-sm px-3 py-1`}>{climate.label}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{climate.description}</p>
                  <p className="text-xs text-slate-400 pt-1">
                    Based on satellite and weather data for {borrower.district ?? "your region"}.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  Climate data not yet available. Your credit officer will run a field analysis.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Field Health ── */}
        {analysis && (
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" /> Field Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FieldMetric
                  icon={<Activity className="h-4 w-4 text-emerald-500" />}
                  label="Health Score"
                  value={`${Math.round(analysis.agriculturalScore)}/100`}
                  sub={scoreLabel(analysis.agriculturalScore)}
                />
                <FieldMetric
                  icon={<Activity className="h-4 w-4 text-emerald-500" />}
                  label="Vegetation Index"
                  value={analysis.meanNDVI.toFixed(3)}
                  sub={analysis.ndviTrend.replace("_", " ")}
                />
                <FieldMetric
                  icon={<Droplets className="h-4 w-4 text-blue-500" />}
                  label="14-Day Rainfall"
                  value={`${analysis.totalRainfall.toFixed(0)} mm`}
                  sub={analysis.waterStressRisk ? "⚠ Low moisture" : "Normal"}
                />
                <FieldMetric
                  icon={<Thermometer className="h-4 w-4 text-orange-500" />}
                  label="Avg Temperature"
                  value={`${analysis.avgTemperature.toFixed(1)} °C`}
                  sub={analysis.diseaseRisk ? "⚠ Heat risk" : "Normal range"}
                />
              </div>
              <p className="text-xs text-slate-400 mt-4">
                Last analysed {new Date(analysis.createdAt).toLocaleDateString()}.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Recommendations ── */}
        {recs.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-emerald-600" /> Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {recs.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-500 font-bold mt-0.5 shrink-0">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function FieldMetric({
  icon, label, value, sub,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
        {icon} {label}
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
