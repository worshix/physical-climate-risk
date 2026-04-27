import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth";
import { generateBorrowerReport, type BorrowerReport } from "@/lib/reports/generateBorrowerReport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";

// ── Helpers ────────────────────────────────────────────────────────────────────

function ratingLabel(r: number) {
  return { 1: "Default", 2: "At Risk", 3: "Watch", 4: "Good", 5: "Excellent" }[r] ?? "Unknown";
}

function ratingColor(r: number) {
  if (r === 1) return "bg-red-100 text-red-700";
  if (r === 2) return "bg-orange-100 text-orange-700";
  if (r === 3) return "bg-amber-100 text-amber-700";
  if (r === 4) return "bg-blue-100 text-blue-700";
  return "bg-emerald-100 text-emerald-700";
}

function gammaColor(gamma: number) {
  if (gamma < -1) return "text-red-600";
  if (gamma < 0) return "text-amber-600";
  return "text-emerald-600";
}

function omegaBar(omega: number) {
  const pct = Math.round(omega * 100);
  const color = omega >= 0.7 ? "bg-red-500" : omega >= 0.4 ? "bg-amber-500" : omega >= 0.2 ? "bg-yellow-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-10 text-right">{(omega).toFixed(3)}</span>
    </div>
  );
}

const SCENARIO_LABELS: Record<string, string> = {
  baseline:        "Baseline",
  moderateDrought: "Moderate Drought",
  severeDrought:   "Severe Drought",
  wetRecovery:     "Wet / Recovery",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function BorrowerReportPage({
  params,
}: {
  params: Promise<{ borrowerId: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/auth/login");

  const { borrowerId } = await params;

  let report: BorrowerReport;
  try {
    report = await generateBorrowerReport(borrowerId);
  } catch {
    notFound();
  }

  const { borrower, loan, climateDroughtSignal, agricultural, creditRisk, scenarioAnalysis, recommendations } = report;

  return (
    <div className="bg-white min-h-screen">
      {/* Print-hidden nav */}
      <nav className="print:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href={`/admin/borrowers/${borrowerId}`}>
            <Button variant="ghost" size="icon" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="text-base font-bold text-slate-900">Borrower Report — {borrower.name}</span>
        </div>
        <PrintButton />
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-10 space-y-10 text-sm">

        {/* ── Cover / Header ── */}
        <div className="border-b-2 border-emerald-600 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Mitiga Global Analytics Engine</p>
              <h1 className="text-2xl font-bold text-slate-900">IFRS 9 ECL Credit Risk Report</h1>
              <p className="text-slate-500 mt-1">{borrower.name} · {borrower.district ?? "—"}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Generated</p>
              <p className="font-medium text-slate-600">{new Date(report.generatedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* ── Section 1: Borrower & Loan ── */}
        <section>
          <h2 className="section-heading">1. Borrower & Loan Summary</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="label">Full Name</p>
              <p className="value">{borrower.name}</p>
              {borrower.nationalId && <><p className="label">National ID</p><p className="value">{borrower.nationalId}</p></>}
              {borrower.district && <><p className="label">District</p><p className="value">{borrower.district}</p></>}
              {borrower.primaryActivity && <><p className="label">Primary Activity</p><p className="value">{borrower.primaryActivity}</p></>}
              {borrower.phone && <><p className="label">Phone</p><p className="value">{borrower.phone}</p></>}
              <p className="label">Registered</p>
              <p className="value">{new Date(borrower.registeredAt).toLocaleDateString()}</p>
            </div>
            <div className="space-y-2">
              {loan ? (
                <>
                  <p className="label">Loan Reference</p>
                  <p className="value font-mono">{loan.loanRef}</p>
                  <p className="label">Current Rating</p>
                  <Badge className={`${ratingColor(loan.currentRating)} border-none`}>
                    {loan.currentRating} — {ratingLabel(loan.currentRating)}
                  </Badge>
                  <p className="label mt-2">IFRS 9 Stage</p>
                  <Badge variant="outline" className="font-mono text-xs">{loan.ifrs9Stage.replace("_", " ")}</Badge>
                  <p className="label mt-2">Outstanding Balance (EAD)</p>
                  <p className="value font-bold text-slate-900">${loan.loanAmount.toLocaleString()}</p>
                  <p className="label">Disbursement Date</p>
                  <p className="value">{new Date(loan.disbursementDate).toLocaleDateString()}</p>
                  <p className="label">Rating Observations</p>
                  <p className="value">{loan.observationCount}</p>
                </>
              ) : (
                <p className="text-slate-400 italic">No active loan registered.</p>
              )}
            </div>
          </div>
        </section>

        <Divider />

        {/* ── Section 2: Climate / Drought Signal ── */}
        <section>
          <h2 className="section-heading">2. Climate & Drought Signal</h2>
          {climateDroughtSignal ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Metric label="γ (Drought Proxy)" value={
                  <span className={`text-2xl font-bold font-mono ${gammaColor(climateDroughtSignal.gamma)}`}>
                    {climateDroughtSignal.gamma.toFixed(2)}
                  </span>
                } sub="SPEI-like index · γ₀ = −1.10" />
                <Metric label="Regime Weight ω(γ)" value={
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    {climateDroughtSignal.regimeWeight.toFixed(3)}
                  </span>
                } sub="0 = fully normal · 1 = fully stress" />
                <Metric label="Regime" value={
                  <Badge className={
                    climateDroughtSignal.regimeWeight >= 0.7 ? "bg-red-100 text-red-700 border-none" :
                    climateDroughtSignal.regimeWeight >= 0.4 ? "bg-amber-100 text-amber-700 border-none" :
                    "bg-emerald-100 text-emerald-700 border-none"
                  }>{climateDroughtSignal.regimeLabel}</Badge>
                } sub="" />
              </div>
              <div>
                <p className="label">Regime Weight Visualisation</p>
                {omegaBar(climateDroughtSignal.regimeWeight)}
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-slate-700 leading-relaxed">
                {climateDroughtSignal.interpretation}
              </div>
              <p className="text-xs text-slate-400">
                Model: P(γ) = ω(γ)·M_stress + (1−ω(γ))·M_normal · ω(γ) = 1/(1+exp(−κ(γ−γ₀))) · κ=1.25, γ₀=−1.10
              </p>
            </div>
          ) : (
            <p className="text-slate-400 italic">Run a field analysis to compute the drought signal.</p>
          )}
        </section>

        <Divider />

        {/* ── Section 3: Agricultural Health ── */}
        <section>
          <h2 className="section-heading">3. Agricultural Health Signal</h2>
          {agricultural ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Metric label="Agri Score" value={
                  <span className="text-2xl font-bold text-slate-900">{agricultural.score}<span className="text-sm text-slate-400">/100</span></span>
                } sub={agricultural.scoreBand} />
                <Metric label="Mean NDVI" value={
                  <span className="text-2xl font-bold font-mono text-slate-900">{agricultural.meanNDVI.toFixed(3)}</span>
                } sub={agricultural.ndviTrend} />
                <Metric label="14-Day Rainfall" value={
                  <span className="text-2xl font-bold text-slate-900">{agricultural.totalRainfall.toFixed(0)}<span className="text-sm text-slate-400">mm</span></span>
                } sub={agricultural.waterStressRisk ? "⚠ Water stress" : "Normal range"} />
                <Metric label="Avg Temperature" value={
                  <span className="text-2xl font-bold text-slate-900">{agricultural.avgTemperature.toFixed(1)}<span className="text-sm text-slate-400">°C</span></span>
                } sub={agricultural.diseaseRisk ? "⚠ Disease risk" : "Normal range"} />
              </div>
              <div className="flex gap-2">
                {agricultural.waterStressRisk && (
                  <Badge className="bg-red-100 text-red-700 border-none text-xs">Water Stress Risk</Badge>
                )}
                {agricultural.diseaseRisk && (
                  <Badge className="bg-amber-100 text-amber-700 border-none text-xs">Disease Risk</Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">Analysis date: {new Date(agricultural.analysedAt).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-slate-400 italic">No satellite analysis available.</p>
          )}
        </section>

        <Divider />

        {/* ── Section 4: Credit Risk ── */}
        <section>
          <h2 className="section-heading">4. Credit Risk Metrics</h2>
          {creditRisk ? (
            <div className="grid grid-cols-3 gap-4">
              <Metric label="1Q Probability of Default" value={
                <span className="text-2xl font-bold font-mono text-orange-600">{(creditRisk.onePeriodPD * 100).toFixed(2)}%</span>
              } sub="One-quarter ahead PD from blended matrix" />
              <Metric label="1-Year ECL" value={
                <span className="text-2xl font-bold text-red-600">${creditRisk.ecl1Year.toFixed(2)}</span>
              } sub={`LGD ${(creditRisk.lgd * 100).toFixed(0)}% · r ${(creditRisk.discountRate * 100).toFixed(0)}%`} />
              <Metric label="5-Year (Lifetime) ECL" value={
                <span className="text-2xl font-bold text-red-700">${creditRisk.ecl5Year.toFixed(2)}</span>
              } sub="20-quarter discounted ECL" />
            </div>
          ) : (
            <p className="text-slate-400 italic">ECL not computed. Run a field analysis to generate ECL.</p>
          )}
        </section>

        <Divider />

        {/* ── Section 5: IFRS 9 Scenario Analysis ── */}
        <section>
          <h2 className="section-heading">5. IFRS 9 Scenario Analysis</h2>
          {scenarioAnalysis ? (
            <div className="space-y-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 text-xs uppercase tracking-wider">Scenario</th>
                    <th className="text-center px-4 py-2.5 font-bold text-slate-500 text-xs uppercase tracking-wider">γ</th>
                    <th className="text-center px-4 py-2.5 font-bold text-slate-500 text-xs uppercase tracking-wider">Probability</th>
                    <th className="text-right px-4 py-2.5 font-bold text-slate-500 text-xs uppercase tracking-wider">1-Year ECL</th>
                    <th className="text-right px-4 py-2.5 font-bold text-slate-500 text-xs uppercase tracking-wider">5-Year ECL</th>
                  </tr>
                </thead>
                <tbody>
                  {(["baseline", "moderateDrought", "severeDrought", "wetRecovery"] as const).map((key) => {
                    const row = scenarioAnalysis[key];
                    return (
                      <tr key={key} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{SCENARIO_LABELS[key]}</td>
                        <td className={`px-4 py-3 text-center font-mono ${gammaColor(row.gamma)}`}>{row.gamma.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">{(row.prob * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3 text-right font-medium">${row.ecl1Year.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium">${row.ecl5Year.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 border-t-2 border-slate-300">
                    <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">Probability-Weighted Expected ECL</td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">${scenarioAnalysis.expected.ecl1Year.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-800">${scenarioAnalysis.expected.ecl5Year.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400 italic">Scenario analysis not available.</p>
          )}
        </section>

        <Divider />

        {/* ── Section 6: Recommendations ── */}
        <section>
          <h2 className="section-heading">6. Agronomic Recommendations</h2>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-700">
                <span className="text-emerald-500 font-bold mt-0.5 shrink-0">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </section>

        <Divider />

        {/* ── Disclaimer ── */}
        <section>
          <p className="text-xs text-slate-400 leading-relaxed italic border-t border-slate-100 pt-4">
            {report.disclaimer}
          </p>
        </section>

      </main>

      {/* Print styles */}
      <style>{`
        @media print {
          nav { display: none !important; }
          .print\\:hidden { display: none !important; }
          body { font-size: 11pt; }
          main { max-width: 100%; padding: 0 1cm; }
        }
        .section-heading {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 1rem;
          padding-bottom: 0.35rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .value { font-size: 0.875rem; color: #1e293b; font-weight: 500; }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Divider() {
  return <hr className="border-slate-100" />;
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-1">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div>{value}</div>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
