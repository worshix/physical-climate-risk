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
  TrendingDown, Droplets, Thermometer, MapPin, AlertTriangle,
  BarChart3,
} from "lucide-react";

function speiLabel(gamma: number): { label: string; color: string; description: string } {
  if (gamma >= 1.5) return {
    label: "Very Wet",
    color: "bg-blue-100 text-blue-700",
    description: "Your region is receiving well-above-normal rainfall. Good conditions for crops.",
  };
  if (gamma >= 1.0) return {
    label: "Moderately Wet",
    color: "bg-blue-100 text-blue-700",
    description: "Above-normal precipitation conditions. Favourable for agriculture.",
  };
  if (gamma >= 0.0) return {
    label: "Good Conditions",
    color: "bg-emerald-100 text-emerald-700",
    description: "Rainfall and temperature conditions in your area are near normal.",
  };
  if (gamma >= -1.0) return {
    label: "Slightly Dry",
    color: "bg-yellow-100 text-yellow-700",
    description: "Conditions are mildly drier than normal. Monitor your field moisture.",
  };
  if (gamma >= -1.5) return {
    label: "Moderate Drought",
    color: "bg-amber-100 text-amber-700",
    description: "Moderate drought stress in your area. This is being factored into your credit assessment.",
  };
  if (gamma >= -2.0) return {
    label: "Severe Drought",
    color: "bg-red-100 text-red-700",
    description: "Significant drought conditions. Your MFI credit officer has been alerted.",
  };
  return {
    label: "Extreme Drought",
    color: "bg-red-200 text-red-800",
    description: "Extreme drought conditions. Please contact your credit officer immediately.",
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
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!borrower) redirect("/auth/login");

  const loan     = borrower.loans[0] ?? null;
  const ecl      = loan?.eclForecasts[0] ?? null;
  const field    = borrower.fields[0] ?? null;
  const analysis = field?.analyses[0] ?? null;

  const gamma   = analysis?.gamma ?? (ecl ? null : null);
  const climate = gamma !== null ? speiLabel(gamma) : null;

  let recs: string[] = [];
  if (analysis?.recommendations) {
    try { recs = JSON.parse(analysis.recommendations); } catch { /* ignore */ }
  }

  const hasField = field !== null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-1.5 rounded-lg shadow-sm">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">Mitiga</span>
        </div>
        <div className="flex items-center gap-2">
          {hasField && (
            <Link href="/borrower/field">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 hover:border-emerald-300 hover:text-emerald-700">
                <MapPin className="h-4 w-4" /> My Farm
              </Button>
            </Link>
          )}
          <Link href="/borrower/report">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-200 hover:border-emerald-300 hover:text-emerald-700">
              <FileText className="h-4 w-4" /> My Report
            </Button>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {borrower.name.charAt(0)}
            </div>
            <span className="text-xs font-medium text-slate-700">{borrower.name}</span>
          </div>
          <LogoutButton />
        </div>
      </nav>

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-6 pt-8 pb-14">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Welcome, {borrower.name.split(" ")[0]}</h1>
          <p className="text-emerald-100 mt-1 text-sm">
            {borrower.district ? `${borrower.district} · ` : ""}{borrower.primaryActivity ?? "Mitiga Borrower"}
          </p>
        </div>
      </div>

      <main className="flex-1 px-6 pb-10 max-w-4xl mx-auto w-full space-y-5 -mt-8">
        {/* Set up farm CTA */}
        {!hasField && (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50 border-l-4 border-l-emerald-500">
            <CardContent className="flex items-center justify-between p-5">
              <div className="space-y-1">
                <p className="font-bold text-emerald-900">Set up your farm to get started</p>
                <p className="text-sm text-emerald-700">
                  Draw your field boundary to receive your SPEI drought index, farm health score, and personalised recommendations.
                </p>
              </div>
              <Link href="/borrower/onboarding">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap ml-4 shadow-sm">
                  Set Up Farm
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {/* My Loan */}
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                </div>
                My Loan
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
                        This estimate is calculated using the IFRS 9 SPEI-conditioned credit risk model.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">No active loan on file. Contact your credit officer.</p>
              )}
            </CardContent>
          </Card>

          {/* SPEI Drought Index */}
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-md">
                  <CloudSun className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Drought Index (SPEI)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {climate && gamma !== null ? (
                <>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-slate-900">{gamma.toFixed(2)}</span>
                    <Badge className={`${climate.color} border-none text-sm px-3 py-1`}>{climate.label}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{climate.description}</p>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1">SPEI Classification (WMO)</p>
                    <div className="text-[10px] text-slate-400 space-y-0.5">
                      <p>≥ 0: Normal/Wet &nbsp;|&nbsp; −1.0 to 0: Mildly Dry</p>
                      <p>−1.0 to −1.5: Moderate Drought &nbsp;|&nbsp; &lt; −1.5: Severe Drought</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Computed from 3 years of historical precipitation and temperature data for {borrower.district ?? "your region"} using the Thornthwaite method.
                  </p>
                  {hasField && (
                    <Link href="/borrower/field">
                      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 mt-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        <BarChart3 className="h-3.5 w-3.5" /> View full analysis
                      </Button>
                    </Link>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  {!hasField ? (
                    <div className="flex items-start gap-2 text-sm text-slate-500">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>Set up your farm field above to get your SPEI drought index and climate score.</span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      SPEI data will appear after your first field analysis.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Field Health */}
        {analysis && (
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-md">
                    <Activity className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  Farm Health
                </CardTitle>
                <Link href="/borrower/field">
                  <Button variant="ghost" size="sm" className="text-xs text-emerald-600 hover:bg-emerald-50">
                    Manage farm →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <FieldMetric
                  icon={<Activity className="h-4 w-4 text-teal-500" />}
                  label="Vegetation (NDVI)"
                  value={analysis.meanNDVI.toFixed(3)}
                  sub={analysis.ndviTrend.replace("_", " ")}
                  accent="border-l-teal-400"
                />
                <FieldMetric
                  icon={<Droplets className="h-4 w-4 text-blue-500" />}
                  label="14-Day Rainfall"
                  value={`${analysis.totalRainfall.toFixed(0)} mm`}
                  sub={analysis.waterStressRisk ? "⚠ Low moisture" : "Normal"}
                  accent="border-l-blue-400"
                />
                <FieldMetric
                  icon={<Thermometer className="h-4 w-4 text-orange-500" />}
                  label="Temperature"
                  value={`${analysis.avgTemperature.toFixed(1)} °C`}
                  sub={analysis.diseaseRisk ? "⚠ Heat risk" : "Normal range"}
                  accent="border-l-orange-400"
                />
              </div>
              <p className="text-xs text-slate-400">
                Last analysed {new Date(analysis.createdAt).toLocaleDateString()}.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-md">
                  <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                </div>
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {recs.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
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
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent: string;
}) {
  return (
    <div className={`rounded-xl border-l-4 ${accent} bg-white shadow-sm p-3 space-y-1`}>
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
        {icon} {label}
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
