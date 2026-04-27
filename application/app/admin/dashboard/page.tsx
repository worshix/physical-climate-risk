import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  Leaf, Plus, Users, TrendingDown, DollarSign,
  AlertTriangle, ChevronRight, Activity,
} from "lucide-react";

function ratingBadge(rating: number) {
  if (rating === 1) return <Badge className="bg-red-100 text-red-700 border-none">Rating 1 — Default</Badge>;
  if (rating === 2) return <Badge className="bg-orange-100 text-orange-700 border-none">Rating 2 — At Risk</Badge>;
  if (rating === 3) return <Badge className="bg-amber-100 text-amber-700 border-none">Rating 3 — Watch</Badge>;
  if (rating === 4) return <Badge className="bg-blue-100 text-blue-700 border-none">Rating 4 — Good</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-none">Rating 5 — Excellent</Badge>;
}

function regimeBadge(omega: number) {
  if (omega >= 0.7) return <Badge className="bg-red-100 text-red-700 border-none">Drought Stress</Badge>;
  if (omega >= 0.4) return <Badge className="bg-amber-100 text-amber-700 border-none">Moderate Stress</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-none">Normal</Badge>;
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
      loans: {
        where: { status: { not: "REPAID" } },
        include: {
          eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const allActiveLoans = borrowers.flatMap((b) =>
    b.loans.filter((l) => l.status === "ACTIVE")
  );
  const totalEAD = allActiveLoans.reduce((s, l) => s + l.loanAmount, 0);
  const totalECL1Year = allActiveLoans.reduce((s, l) => {
    const ecl = l.eclForecasts[0];
    return s + (ecl?.ecl1Year ?? 0);
  }, 0);
  const totalDefaulted = borrowers.flatMap((b) => b.loans).filter((l) => l.status === "DEFAULT").length;
  const provisioningRate = totalEAD > 0 ? (totalECL1Year / totalEAD) * 100 : 0;

  const loanRows = borrowers.flatMap((b) =>
    b.loans.map((l) => {
      const ecl = l.eclForecasts[0];
      return {
        borrowerId: b.id,
        borrowerName: b.name,
        district: b.district ?? "—",
        loanRef: l.loanRef,
        loanId: l.id,
        rating: l.currentRating,
        ead: l.loanAmount,
        status: l.status,
        gamma: ecl?.currentGamma ?? null,
        omega: ecl?.regimeWeight ?? null,
        pd1Q: ecl?.onePeriodPD ?? null,
        ecl1Year: ecl?.ecl1Year ?? null,
        stage: l.stage,
      };
    })
  );

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
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Portfolio Overview</h1>
            </div>
            <p className="text-slate-500 mt-1 ml-4">
              {borrowers.length} registered borrowers · {allActiveLoans.length} active loans
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
                Active Borrowers
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-slate-900">{borrowers.length}</p>
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
              <p className="text-xs text-slate-400 mt-0.5">
                {provisioningRate.toFixed(1)}% provisioning rate
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-600" />
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-md">
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                </div>
                In Default
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <p className="text-3xl font-bold text-red-600">{totalDefaulted}</p>
            </CardContent>
          </Card>
        </div>

        {/* Loan Table */}
        {loanRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-100 text-center">
            <div className="bg-white p-6 rounded-full mb-6 shadow-md">
              <Users className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No borrowers yet</h2>
            <p className="text-slate-500 mb-8 max-w-sm">
              Register your first borrower to begin tracking credit risk and ECL.
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
                  <Activity className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Active Loan Book
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Borrower</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">District</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Loan Ref</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Rating</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">EAD ($)</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Regime</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">1Q PD</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">1-Yr ECL ($)</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Stage</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loanRows.map((row) => (
                    <tr key={row.loanId} className="border-b border-slate-50 hover:bg-emerald-50/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{row.borrowerName}</td>
                      <td className="px-4 py-4 text-slate-500">{row.district}</td>
                      <td className="px-4 py-4 text-slate-500 font-mono text-xs">{row.loanRef}</td>
                      <td className="px-4 py-4 text-center">{ratingBadge(row.rating)}</td>
                      <td className="px-4 py-4 text-right font-medium">{row.ead.toLocaleString()}</td>
                      <td className="px-4 py-4">
                        {row.omega !== null ? regimeBadge(row.omega) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs">
                        {row.pd1Q !== null ? `${(row.pd1Q * 100).toFixed(1)}%` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right font-medium">
                        {row.ecl1Year !== null ? `$${row.ecl1Year.toFixed(2)}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="text-xs font-mono">
                          {row.stage.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/admin/borrowers/${row.borrowerId}`}>
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-700 hover:bg-emerald-50">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
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
