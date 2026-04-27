import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/LogoutButton";
import {
  ArrowLeft, Leaf, User, MapPin, Phone,
  Activity, FileText, ExternalLink, Briefcase, CreditCard,
} from "lucide-react";

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
      fields: {
        include: {
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!borrower) notFound();

  const latestField    = borrower.fields[0] ?? null;
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

      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
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
                    <span className="text-2xl font-bold text-slate-900">
                      {Math.round(latestAnalysis.agriculturalScore)}
                      <span className="text-sm text-slate-400">/100</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">SPEI-3 (γ)</span>
                    <span className={`font-mono text-sm font-semibold ${latestAnalysis.gamma < -1 ? "text-red-600" : latestAnalysis.gamma < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {latestAnalysis.gamma.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Regime Weight ω(γ)</span>
                    <span className="font-mono text-sm">{latestAnalysis.regimeWeight.toFixed(3)}</span>
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
                  <div className="flex gap-2 pt-1">
                    {latestAnalysis.waterStressRisk && (
                      <Badge className="bg-red-100 text-red-700 border-none text-xs">Water Stress</Badge>
                    )}
                    {latestAnalysis.diseaseRisk && (
                      <Badge className="bg-amber-100 text-amber-700 border-none text-xs">Disease Risk</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 pt-1">
                    Last analysed {new Date(latestAnalysis.createdAt).toLocaleDateString()}
                  </p>
                  <Link href={`/admin/fields/${latestField.id}/analyse`} className="block pt-1">
                    <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" /> View Full Field Details & Recommendations
                    </Button>
                  </Link>
                </>
              ) : latestField ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Field registered — farmer hasn&apos;t run an analysis yet.
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">
                  Farmer hasn&apos;t set up their farm yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Registered Fields ── */}
        {borrower.fields.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" /> Registered Fields
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                {borrower.fields.map((field) => {
                  const analysis = field.analyses[0] ?? null;
                  return (
                    <div key={field.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{field.name}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{field.cropType}</span>
                          {field.area && <span>{(field.area / 10000).toFixed(2)} ha</span>}
                          {field.location && <span>{field.location}</span>}
                          {analysis ? (
                            <span className="text-emerald-600">
                              Analysed {new Date(analysis.createdAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No analysis yet</span>
                          )}
                        </div>
                      </div>
                      <Link href={`/admin/fields/${field.id}/analyse`}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <ExternalLink className="h-3.5 w-3.5" /> View
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
