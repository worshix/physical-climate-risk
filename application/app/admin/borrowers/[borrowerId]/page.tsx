import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  ArrowLeft, Leaf, User, MapPin, Phone, CreditCard,
  TrendingDown, Activity, Plus, FileText, ChevronRight,
  Briefcase, ExternalLink,
} from "lucide-react";

function ratingBadge(rating: number) {
  const map: Record<number, string> = {
    1: "bg-red-100 text-red-700",
    2: "bg-orange-100 text-orange-700",
    3: "bg-amber-100 text-amber-700",
    4: "bg-blue-100 text-blue-700",
    5: "bg-emerald-100 text-emerald-700",
  };
  const labels: Record<number, string> = { 1: "Default", 2: "At Risk", 3: "Watch", 4: "Good", 5: "Excellent" };
  return (
    <Badge className={`${map[rating] ?? "bg-slate-100 text-slate-600"} border-none`}>
      {rating} — {labels[rating] ?? "Unknown"}
    </Badge>
  );
}

function stageBadge(stage: string) {
  const map: Record<string, string> = {
    STAGE_1: "bg-emerald-50 text-emerald-700",
    STAGE_2: "bg-amber-50 text-amber-700",
    STAGE_3: "bg-red-50 text-red-700",
  };
  return (
    <Badge className={`${map[stage] ?? "bg-slate-50 text-slate-600"} border-none text-xs`}>
      {stage.replace("_", " ")}
    </Badge>
  );
}

export default async function BorrowerDetailPage({
  params,
}: {
  params: Promise<{ borrowerId: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/auth/login");

  const { borrowerId } = await params;

  const borrower = await prisma.user.findUnique({
    where: { id: borrowerId, role: "BORROWER" },
    include: {
      loans: {
        include: {
          observations: { orderBy: { obsDate: "asc" } },
          eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      },
      fields: {
        include: {
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!borrower) notFound();

  const activeLoans = borrower.loans.filter((l) => l.status !== "REPAID");
  const latestLoan = activeLoans[0];
  const latestECL = latestLoan?.eclForecasts[0] ?? null;
  const latestField = borrower.fields[0];
  const latestAnalysis = latestField?.analyses[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="icon" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">{borrower.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/admin/borrowers/${borrowerId}/report`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="h-4 w-4" /> Generate Report
            </Button>
          </Link>
          <LogoutButton />
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full space-y-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* ── Borrower Profile ── */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Full Name</p>
                  <p className="font-semibold text-slate-900">{borrower.name}</p>
                </div>
              </div>
              {borrower.nationalId && (
                <div className="flex items-start gap-2">
                  <CreditCard className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">National ID</p>
                    <p className="font-medium text-slate-700">{borrower.nationalId}</p>
                  </div>
                </div>
              )}
              {borrower.district && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">District</p>
                    <p className="font-medium text-slate-700">{borrower.district}</p>
                  </div>
                </div>
              )}
              {borrower.primaryActivity && (
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Primary Activity</p>
                    <p className="font-medium text-slate-700">{borrower.primaryActivity}</p>
                  </div>
                </div>
              )}
              {borrower.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Phone</p>
                    <p className="font-medium text-slate-700">{borrower.phone}</p>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Registered {new Date(borrower.createdAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Latest ECL Summary ── */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-emerald-600" /> Credit Risk (Latest)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestLoan ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Current Rating</span>
                    {ratingBadge(latestLoan.currentRating)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">IFRS 9 Stage</span>
                    {stageBadge(latestLoan.stage)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">EAD (Outstanding)</span>
                    <span className="font-semibold text-slate-900">${latestLoan.loanAmount.toLocaleString()}</span>
                  </div>
                  {latestECL ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Regime Weight ω(γ)</span>
                        <span className="font-mono text-sm">{latestECL.regimeWeight.toFixed(3)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">1Q Probability of Default</span>
                        <span className="font-mono text-sm text-orange-600">{(latestECL.onePeriodPD * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-xs font-bold text-slate-500">1-Year ECL</span>
                        <span className="font-bold text-red-600">${latestECL.ecl1Year.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">5-Year ECL</span>
                        <span className="font-bold text-red-700">${latestECL.ecl5Year.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic pt-2">No ECL computed yet. Run analysis on the borrower&apos;s field.</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">No active loan. Add a loan to compute ECL.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Agricultural Signal ── */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" /> Agricultural Signal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestAnalysis && latestField ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Agri Score</span>
                    <span className="text-2xl font-bold text-slate-900">{Math.round(latestAnalysis.agriculturalScore)}<span className="text-sm text-slate-400">/100</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">SPEI-3 (γ)</span>
                    <span className={`font-mono text-sm font-semibold ${latestAnalysis.gamma < -1 ? "text-red-600" : latestAnalysis.gamma < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {latestAnalysis.gamma.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Mean NDVI</span>
                    <span className="font-mono text-sm">{latestAnalysis.meanNDVI.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">14-Day Rainfall</span>
                    <span className="font-mono text-sm">{latestAnalysis.totalRainfall.toFixed(1)} mm</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Avg Temperature</span>
                    <span className="font-mono text-sm">{latestAnalysis.avgTemperature.toFixed(1)} °C</span>
                  </div>
                  <p className="text-xs text-slate-400 pt-1">
                    Last analysed {new Date(latestAnalysis.createdAt).toLocaleDateString()}
                  </p>
                  <Link href={`/admin/fields/${latestField.id}/analyse`} className="block pt-1">
                    <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" /> View Full Field Details
                    </Button>
                  </Link>
                </>
              ) : latestField ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Field registered — farmer hasn&apos;t run analysis yet.
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">
                  Farmer hasn&apos;t set up their farm yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Loan History ── */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" /> Loan History
            </CardTitle>
            <Link href={`/admin/loans/new?borrowerId=${borrowerId}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Loan
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {activeLoans.length === 0 ? (
              <p className="text-sm text-slate-400 italic p-6">No loans registered.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {activeLoans.map((loan) => {
                  const ecl = loan.eclForecasts[0];
                  return (
                    <div key={loan.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 font-mono text-sm">{loan.loanRef}</span>
                          {stageBadge(loan.stage)}
                          <Badge variant={loan.status === "DEFAULT" ? "destructive" : "secondary"} className="text-xs">
                            {loan.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>Rating: <strong>{loan.currentRating}</strong></span>
                          <span>EAD: <strong>${loan.loanAmount.toLocaleString()}</strong></span>
                          <span>Disbursed: {new Date(loan.disbursementDate).toLocaleDateString()}</span>
                          <span>{loan.observations.length} observations</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {ecl && (
                          <div className="text-right text-xs">
                            <p className="text-slate-400">1-Yr ECL</p>
                            <p className="font-bold text-red-600">${ecl.ecl1Year.toFixed(2)}</p>
                          </div>
                        )}
                        <Link href={`/admin/loans/${loan.id}`}>
                          <Button variant="ghost" size="sm" className="text-slate-400">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Rating Observation History ── */}
        {latestLoan && latestLoan.observations.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" /> Rating Observation Timeline
                <Badge variant="secondary" className="ml-1 text-xs">{latestLoan.loanRef}</Badge>
              </CardTitle>
              <Link href={`/admin/loans/${latestLoan.id}/add-observation`}>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Observation
                </Button>
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Period</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Rating</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Balance ($)</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">γ (SPEI)</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Default</th>
                  </tr>
                </thead>
                <tbody>
                  {latestLoan.observations.map((obs) => (
                    <tr key={obs.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3 font-mono text-xs font-semibold">{obs.obsPeriod}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(obs.obsDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-center">{ratingBadge(obs.rating)}</td>
                      <td className="px-4 py-3 text-right font-medium">{obs.loanAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span className={obs.gamma < -1 ? "text-red-600" : obs.gamma < 0 ? "text-amber-600" : "text-emerald-600"}>
                          {obs.gamma.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {obs.defaultFlag
                          ? <Badge className="bg-red-100 text-red-700 border-none text-xs">Yes</Badge>
                          : <Badge className="bg-slate-100 text-slate-500 border-none text-xs">No</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
