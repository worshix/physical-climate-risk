"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Leaf, ArrowLeft, RefreshCw, Loader2, Activity,
  Droplets, Thermometer, TrendingDown, BarChart3,
  CheckCircle2, AlertTriangle, CloudSun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/LogoutButton";
import dynamic from "next/dynamic";

// Leaflet is SSR-incompatible — load client-side only
const FieldMap = dynamic(() => import("@/components/Map/FieldMap"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Analysis {
  id: string;
  meanNDVI: number;
  ndviTrend: string;
  healthStatus: string;
  avgTemperature: number;
  totalRainfall: number;
  waterStressRisk: boolean;
  diseaseRisk: boolean;
  gamma: number;
  regimeWeight: number;
  agriculturalScore: number;
  recommendations: string;
  createdAt: string;
}

interface Field {
  id: string;
  name: string;
  cropType: string;
  polygon: string;
  area: number | null;
  location: string | null;
  district: string | null;
  analyses: Analysis[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function speiLabel(gamma: number): string {
  if (gamma >= 1.5)  return "Very Wet";
  if (gamma >= 1.0)  return "Moderately Wet";
  if (gamma >= 0.0)  return "Near Normal";
  if (gamma >= -1.0) return "Mildly Dry";
  if (gamma >= -1.5) return "Moderately Dry";
  if (gamma >= -2.0) return "Severely Dry";
  return "Extremely Dry";
}

function speiColor(gamma: number): string {
  if (gamma >= 1.0)  return "bg-blue-100 text-blue-700";
  if (gamma >= 0.0)  return "bg-emerald-100 text-emerald-700";
  if (gamma >= -1.0) return "bg-yellow-100 text-yellow-700";
  if (gamma >= -1.5) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-blue-600";
  if (score >= 25) return "text-amber-600";
  return "text-red-600";
}

function healthLabel(status: string): string {
  if (status === "HEALTHY") return "Healthy";
  if (status === "MODERATE_STRESS") return "Moderate Stress";
  return "High Stress";
}

export default function BorrowerFieldPage() {
  const router = useRouter();
  const [field, setField]       = useState<Field | null>(null);
  const [loading, setLoading]   = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadField = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/borrower/field");
      if (!res.ok) throw new Error("Could not load field data.");
      const fields = await res.json() as Field[];
      setField(fields[0] ?? null);
    } catch {
      setError("Failed to load your field data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadField(); }, [loadField]);

  const handleReanalyse = async () => {
    if (!field) return;
    setAnalysing(true);
    setError(null);
    try {
      const res = await fetch(`/api/borrower/field/${field.id}/analyse`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Analysis failed.");
      }
      showToast("Field re-analysed successfully!");
      await loadField();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setAnalysing(false);
    }
  };

  // ── No field yet ────────────────────────────────────────────────────────────
  if (!loading && !field) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Nav />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <div className="bg-slate-100 rounded-full p-6 inline-flex">
              <Leaf className="h-10 w-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">No field registered yet</h2>
            <p className="text-sm text-slate-500">
              Set up your farm to get your drought index (SPEI), farm health score, and climate-adjusted risk profile.
            </p>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 w-full"
              onClick={() => router.push("/borrower/onboarding")}
            >
              Set Up My Farm
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const analysis = field?.analyses[0] ?? null;
  const polygon  = field ? JSON.parse(field.polygon) : null;

  let recs: string[] = [];
  if (analysis?.recommendations) {
    try { recs = JSON.parse(analysis.recommendations); } catch { /* ignore */ }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Nav />

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {toast}
        </div>
      )}

      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{field?.name}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {field?.cropType}
              {field?.location ? ` · ${field.location}` : ""}
              {field?.area ? ` · ${(field.area / 10000).toFixed(2)} ha` : ""}
            </p>
          </div>
          <Button
            onClick={handleReanalyse}
            disabled={analysing || loading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {analysing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</>
              : <><RefreshCw className="h-4 w-4" /> Re-analyse</>}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* SPEI / Drought Index */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <CloudSun className="h-4 w-4 text-emerald-600" /> Drought Index (SPEI-3)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis ? (
                  <>
                    <div className="flex items-center gap-4">
                      <span className="text-4xl font-black text-slate-900">
                        {analysis.gamma.toFixed(2)}
                      </span>
                      <Badge className={`${speiColor(analysis.gamma)} border-none text-sm px-3 py-1`}>
                        {speiLabel(analysis.gamma)}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      The SPEI (Standardized Precipitation Evapotranspiration Index) is computed from
                      3 years of historical rainfall and temperature data. Values below −1.0 indicate
                      drought stress that can affect your crop yields and credit assessment.
                    </p>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Regime weight ω(γ)</span>
                        <span className="font-mono font-semibold">{(analysis.regimeWeight * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Drought stress probability</span>
                        <span className={`font-semibold ${analysis.regimeWeight >= 0.5 ? "text-red-600" : "text-emerald-600"}`}>
                          {analysis.regimeWeight >= 0.5 ? "High" : "Low"}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <p className="font-semibold text-slate-500">WMO SPEI Classification</p>
                      <p>≥ 0.0: Normal / Wet &nbsp;|&nbsp; −1.0 to 0: Mildly Dry</p>
                      <p>−1.0 to −1.5: Moderate Drought &nbsp;|&nbsp; &lt; −1.5: Severe Drought</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No analysis yet. Click &quot;Re-analyse&quot; to fetch your SPEI drought index.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Agricultural Score */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" /> Farm Health Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis ? (
                  <>
                    <div className="flex items-end gap-3">
                      <span className={`text-5xl font-black ${scoreColor(analysis.agriculturalScore)}`}>
                        {Math.round(analysis.agriculturalScore)}
                      </span>
                      <span className="text-slate-400 text-lg mb-1">/ 100</span>
                      <Badge variant="outline" className="mb-1 text-xs">
                        {healthLabel(analysis.healthStatus)}
                      </Badge>
                    </div>

                    {/* Score bar */}
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${analysis.agriculturalScore >= 65 ? "bg-emerald-500" : analysis.agriculturalScore >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${analysis.agriculturalScore}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <Metric icon={<Activity className="h-3.5 w-3.5 text-emerald-500" />} label="NDVI" value={analysis.meanNDVI.toFixed(3)} sub={analysis.ndviTrend} />
                      <Metric icon={<Droplets className="h-3.5 w-3.5 text-blue-500" />} label="14-day Rainfall" value={`${analysis.totalRainfall.toFixed(0)} mm`} sub={analysis.waterStressRisk ? "⚠ Low moisture" : "Normal"} />
                      <Metric icon={<Thermometer className="h-3.5 w-3.5 text-orange-500" />} label="Temperature" value={`${analysis.avgTemperature.toFixed(1)} °C`} sub={analysis.diseaseRisk ? "⚠ Heat risk" : "Normal"} />
                      <Metric icon={<CloudSun className="h-3.5 w-3.5 text-slate-500" />} label="Data source" value="SPEI-3" sub="Open-Meteo archive" />
                    </div>

                    <p className="text-xs text-slate-400">
                      Last analysed {new Date(analysis.createdAt).toLocaleString()}.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">Run an analysis to see your farm health score.</p>
                )}
              </CardContent>
            </Card>

            {/* Map */}
            {polygon && (
              <Card className="border-slate-200 md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-emerald-600" /> Field Map
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden rounded-b-xl">
                  <div className="h-80">
                    <FieldMap
                      polygon={polygon}
                      editable={false}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {recs.length > 0 && (
              <Card className="border-slate-200 md:col-span-2">
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
          </div>
        )}
      </main>
    </div>
  );
}

function Nav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Link href="/borrower/dashboard">
          <Button variant="ghost" size="icon" className="text-slate-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">My Farm</span>
        </div>
      </div>
      <LogoutButton />
    </nav>
  );
}

function Metric({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        {icon} {label}
      </div>
      <p className="text-base font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}
