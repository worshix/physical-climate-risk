import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBorrowerSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Leaf } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";

// Farmer-friendly language — no raw model parameters exposed
function climateStatus(omega: number) {
  if (omega >= 0.7) return { label: "Drought Stress",    color: "bg-red-100 text-red-700",     description: "Your area is under significant drought stress. This is being factored into your credit assessment." };
  if (omega >= 0.4) return { label: "Moderate Dry Spell", color: "bg-amber-100 text-amber-700", description: "Moderate dry-season conditions are present. Your credit officer is monitoring this closely." };
  if (omega >= 0.2) return { label: "Slightly Dry",       color: "bg-yellow-100 text-yellow-700", description: "Conditions are slightly drier than average but within acceptable range." };
  return              { label: "Good Conditions",          color: "bg-emerald-100 text-emerald-700", description: "Climate conditions in your region are favourable." };
}

function ratingLabel(r: number) {
  return { 1: "Critical", 2: "Needs Attention", 3: "Satisfactory", 4: "Good", 5: "Excellent" }[r] ?? "Unknown";
}

function scoreLabel(s: number) {
  if (s >= 75) return "Excellent";
  if (s >= 50) return "Good";
  if (s >= 25) return "Moderate Concern";
  return "Needs Attention";
}

export default async function BorrowerReportPage() {
  const session = await getBorrowerSession();
  if (!session) redirect("/auth/login");

  const borrower = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      loans: {
        where: { status: { not: "REPAID" } },
        include: {
          observations: { orderBy: { obsDate: "asc" } },
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

  const loan     = borrower.loans[0] ?? null;
  const ecl      = loan?.eclForecasts[0] ?? null;
  const analysis = borrower.fields[0]?.analyses[0] ?? null;
  const climate  = ecl ? climateStatus(ecl.regimeWeight) : null;

  let recs: string[] = [];
  if (analysis?.recommendations) {
    try { recs = JSON.parse(analysis.recommendations); } catch { /* ignore */ }
  }

  const generatedAt = new Date().toLocaleString();

  return (
    <div className="bg-white min-h-screen">
      {/* Nav — hidden when printing */}
      <nav className="print:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/borrower/dashboard">
            <Button variant="ghost" size="icon" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="text-base font-bold text-slate-900">My Report</span>
        </div>
        <PrintButton />
      </nav>

      <main className="max-w-3xl mx-auto px-8 py-10 space-y-10 text-sm">

        {/* Header */}
        <div className="border-b-2 border-emerald-600 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">AgriFin Risk Monitor</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">My Loan & Farm Status Report</h1>
              <p className="text-slate-500 mt-1">{borrower.name} · {borrower.district ?? "—"}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Generated</p>
              <p className="font-medium text-slate-600">{generatedAt}</p>
            </div>
          </div>
        </div>

        {/* Section 1: My Details */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">My Details</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <RowItem label="Full Name"        value={borrower.name} />
            {borrower.nationalId    && <RowItem label="National ID"       value={borrower.nationalId} />}
            {borrower.district      && <RowItem label="District"          value={borrower.district} />}
            {borrower.primaryActivity && <RowItem label="Primary Activity" value={borrower.primaryActivity} />}
            {borrower.phone         && <RowItem label="Phone"             value={borrower.phone} />}
            <RowItem label="Member Since"     value={new Date(borrower.createdAt).toLocaleDateString()} />
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* Section 2: My Loan */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">My Loan</h2>
          {loan ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <RowItem label="Loan Reference"     value={loan.loanRef} mono />
              <RowItem label="Credit Standing"    value={ratingLabel(loan.currentRating)} />
              <RowItem label="Outstanding Balance" value={`$${loan.loanAmount.toLocaleString()}`} bold />
              <RowItem label="Loan Status"         value={loan.status} />
              <RowItem label="Disbursement Date"   value={new Date(loan.disbursementDate).toLocaleDateString()} />
              <RowItem label="Payment Records"     value={`${loan.observations.length} observations`} />
            </div>
          ) : (
            <p className="text-slate-400 italic">No active loan on file.</p>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* Section 3: Climate & Weather */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">Climate & Weather Conditions</h2>
          {climate ? (
            <div className="space-y-3">
              <Badge className={`${climate.color} border-none text-sm px-3 py-1`}>{climate.label}</Badge>
              <p className="text-slate-700 leading-relaxed">{climate.description}</p>
              <p className="text-xs text-slate-400">
                Our system uses satellite and weather data to monitor climate conditions in your district. This information helps your credit officer assess loan risk under IFRS 9 international accounting standards.
              </p>
            </div>
          ) : (
            <p className="text-slate-400 italic">No climate data available yet.</p>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* Section 4: Farm Health */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">Farm Health</h2>
          {analysis ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <RowItem label="Overall Health Score" value={`${Math.round(analysis.agriculturalScore)}/100 — ${scoreLabel(analysis.agriculturalScore)}`} bold />
                <RowItem label="Vegetation Health (NDVI)" value={analysis.meanNDVI.toFixed(3)} mono />
                <RowItem label="Vegetation Trend" value={analysis.ndviTrend.replace("_", " ")} />
                <RowItem label="14-Day Rainfall"   value={`${analysis.totalRainfall.toFixed(1)} mm`} />
                <RowItem label="Average Temperature" value={`${analysis.avgTemperature.toFixed(1)} °C`} />
                <RowItem label="Water Stress Risk"  value={analysis.waterStressRisk ? "Yes — irrigation recommended" : "No"} />
              </div>
              <p className="text-xs text-slate-400 mt-2">Farm data last updated: {new Date(analysis.createdAt).toLocaleDateString()}</p>
            </div>
          ) : (
            <p className="text-slate-400 italic">No farm analysis on file. Contact your credit officer to schedule a satellite assessment.</p>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* Section 5: Credit Exposure */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">Credit Exposure Estimate</h2>
          {ecl ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">12-Month Exposure Estimate</span>
                  <span className="font-bold text-red-600 text-lg">${ecl.ecl1Year.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Lifetime Exposure Estimate</span>
                  <span className="font-bold text-red-700 text-lg">${ecl.ecl5Year.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                These figures represent estimated credit loss provisions calculated for IFRS 9 accounting purposes. They do not represent amounts you owe, but rather an estimate of the financial institution&apos;s potential exposure. Computed {new Date(ecl.computedAt).toLocaleDateString()}.
              </p>
            </div>
          ) : (
            <p className="text-slate-400 italic">No exposure estimate available.</p>
          )}
        </section>

        {recs.length > 0 && (
          <>
            <hr className="border-slate-100" />
            <section className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">Recommendations for Your Farm</h2>
              <ul className="space-y-2">
                {recs.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <span className="text-emerald-500 font-bold mt-0.5 shrink-0">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <hr className="border-slate-100" />

        {/* Disclaimer */}
        <p className="text-xs text-slate-400 italic leading-relaxed">
          This report is generated using satellite-derived agricultural signals and a Two-Regime Markov-Switching credit risk model. All figures are estimates for IFRS 9 Expected Credit Loss provisioning purposes only and do not constitute a demand for payment or financial advice. Please consult your credit officer for any questions.
        </p>
      </main>

      <style>{`
        @media print {
          nav { display: none !important; }
          main { max-width: 100%; padding: 0 1cm; }
        }
      `}</style>
    </div>
  );
}

function RowItem({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`mt-0.5 text-slate-800 ${bold ? "font-bold" : "font-medium"} ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
