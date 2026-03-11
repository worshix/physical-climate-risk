import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  ArrowLeft, Leaf, CreditCard, Activity, TrendingDown, Plus,
} from "lucide-react";

function ratingBadge(rating: number) {
  const classes: Record<number, string> = {
    1: "bg-red-100 text-red-700",
    2: "bg-orange-100 text-orange-700",
    3: "bg-amber-100 text-amber-700",
    4: "bg-blue-100 text-blue-700",
    5: "bg-emerald-100 text-emerald-700",
  };
  const labels: Record<number, string> = { 1: "Default", 2: "At Risk", 3: "Watch", 4: "Good", 5: "Excellent" };
  return (
    <Badge className={`${classes[rating] ?? "bg-slate-100 text-slate-600"} border-none`}>
      {rating} — {labels[rating] ?? "Unknown"}
    </Badge>
  );
}

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/auth/login");

  const { loanId } = await params;

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: { id: true, name: true } },
      observations: { orderBy: { obsDate: "asc" } },
      eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });
  if (!loan) notFound();

  const latestECL = loan.eclForecasts[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href={`/admin/borrowers/${loan.borrower.id}`}>
            <Button variant="ghost" size="icon" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 font-mono">{loan.loanRef}</span>
          <Badge variant="secondary" className="text-xs">{loan.status}</Badge>
        </div>
        <LogoutButton />
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Loan summary */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" /> Loan Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Borrower</span>
                <Link href={`/admin/borrowers/${loan.borrower.id}`} className="font-semibold text-emerald-700 hover:underline">
                  {loan.borrower.name}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Rating</span>
                {ratingBadge(loan.currentRating)}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">IFRS 9 Stage</span>
                <Badge variant="outline" className="text-xs font-mono">{loan.stage.replace("_", " ")}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outstanding Balance</span>
                <span className="font-semibold">${loan.loanAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Disbursement Date</span>
                <span>{new Date(loan.disbursementDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Observations</span>
                <span className="font-medium">{loan.observations.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* ECL summary */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-emerald-600" /> Latest ECL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {latestECL ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">γ at computation</span>
                    <span className="font-mono">{latestECL.currentGamma.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Regime Weight ω(γ)</span>
                    <span className="font-mono">{latestECL.regimeWeight.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">1Q PD</span>
                    <span className="font-mono text-orange-600">{(latestECL.onePeriodPD * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2">
                    <span className="font-bold text-slate-600">1-Year ECL</span>
                    <span className="font-bold text-red-600">${latestECL.ecl1Year.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">5-Year ECL</span>
                    <span className="font-bold text-red-700">${latestECL.ecl5Year.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected ECL</span>
                    <span className="font-bold text-red-800">${latestECL.eclExpected.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Computed {new Date(latestECL.computedAt).toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">No ECL computed. Run a field analysis to generate ECL.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Observation timeline */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" /> Rating Observations
            </CardTitle>
            <Link href={`/admin/loans/${loanId}/add-observation`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Observation
              </Button>
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            {loan.observations.length === 0 ? (
              <p className="text-sm text-slate-400 italic p-6">No observations yet.</p>
            ) : (
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
                  {loan.observations.map((obs) => (
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
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
