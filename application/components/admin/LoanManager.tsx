"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Plus,
  ChevronDown,
  ChevronUp,
  Calculator,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Trash2,
  TrendingUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ECLForecast {
  id: string;
  computedAt: string;
  currentGamma: number;
  regimeWeight: number;
  onePeriodPD: number;
  ecl1Year: number;
  ecl5Year: number;
  eclExpected: number;
  eclBaseline: number;
  eclModerateDrought: number;
  eclSevereDrought: number;
  eclWetRecovery: number;
  lgd: number;
  discountRate: number;
}

interface RatingObservation {
  id: string;
  obsPeriod: string;
  obsDate: string;
  rating: number;
  defaultFlag: boolean;
  gamma: number;
  loanAmount: number;
}

export interface LoanData {
  id: string;
  loanRef: string;
  currentRating: number;
  loanAmount: number;
  disbursementDate: string;
  stage: string;
  status: string;
  createdAt: string;
  observations: RatingObservation[];
  eclForecasts: ECLForecast[];
}

interface Props {
  borrowerId: string;
  initialLoans: LoanData[];
  latestGamma: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  STAGE_1: "Stage 1",
  STAGE_2: "Stage 2",
  STAGE_3: "Stage 3",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  DEFAULT: "bg-red-100 text-red-700",
  REPAID: "bg-slate-100 text-slate-500",
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number) {
  return (n * 100).toFixed(3) + "%";
}

function gammaColor(g: number) {
  if (g < -1.5) return "text-red-600";
  if (g < -1.0) return "text-orange-600";
  if (g < 0) return "text-amber-600";
  return "text-emerald-600";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LoanManager({ borrowerId, initialLoans, latestGamma }: Props) {
  const [loans, setLoans] = useState<LoanData[]>(initialLoans);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(
    initialLoans.length === 1 ? initialLoans[0].id : null
  );

  // Add Loan form
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [addingLoan, setAddingLoan] = useState(false);
  const [addLoanError, setAddLoanError] = useState<string | null>(null);
  const [newLoan, setNewLoan] = useState({
    loanRef: "",
    loanAmount: "",
    currentRating: "3",
    disbursementDate: "",
    stage: "STAGE_1",
    status: "ACTIVE",
  });

  // ECL computation
  const [computingECL, setComputingECL] = useState<string | null>(null);
  const [eclError, setECLError] = useState<string | null>(null);

  // Add Observation form (keyed per loan)
  const [showAddObs, setShowAddObs] = useState<string | null>(null);
  const [addingObs, setAddingObs] = useState(false);
  const [addObsError, setAddObsError] = useState<string | null>(null);
  const [newObs, setNewObs] = useState({
    obsPeriod: "",
    obsDate: "",
    rating: "3",
    defaultFlag: false,
    gamma: latestGamma !== null ? String(latestGamma) : "-0.73",
    loanAmount: "",
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleAddLoan(e: React.FormEvent) {
    e.preventDefault();
    setAddingLoan(true);
    setAddLoanError(null);
    try {
      const res = await fetch("/api/admin/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrowerId,
          loanRef: newLoan.loanRef,
          loanAmount: Number(newLoan.loanAmount),
          currentRating: Number(newLoan.currentRating),
          disbursementDate: newLoan.disbursementDate,
          stage: newLoan.stage,
          status: newLoan.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddLoanError(data.error);
        return;
      }
      const newEntry: LoanData = { ...data, observations: [], eclForecasts: [] };
      setLoans((prev) => [newEntry, ...prev]);
      setExpandedLoanId(newEntry.id);
      setNewLoan({
        loanRef: "",
        loanAmount: "",
        currentRating: "3",
        disbursementDate: "",
        stage: "STAGE_1",
        status: "ACTIVE",
      });
      setShowAddLoan(false);
    } catch {
      setAddLoanError("Network error — please try again.");
    } finally {
      setAddingLoan(false);
    }
  }

  async function handleComputeECL(loanId: string) {
    setComputingECL(loanId);
    setECLError(null);
    try {
      const body = latestGamma !== null ? { gamma: latestGamma } : {};
      const res = await fetch(`/api/admin/loans/${loanId}/ecl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setECLError(data.error ?? "ECL computation failed");
        return;
      }
      setLoans((prev) =>
        prev.map((l) =>
          l.id === loanId
            ? { ...l, eclForecasts: [data.forecast, ...l.eclForecasts] }
            : l
        )
      );
    } catch {
      setECLError("Network error — please try again.");
    } finally {
      setComputingECL(null);
    }
  }

  async function handleAddObs(e: React.FormEvent, loanId: string) {
    e.preventDefault();
    setAddingObs(true);
    setAddObsError(null);
    const parentLoan = loans.find((l) => l.id === loanId);
    try {
      const res = await fetch(`/api/admin/loans/${loanId}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          obsPeriod: newObs.obsPeriod,
          obsDate: newObs.obsDate,
          rating: Number(newObs.rating),
          defaultFlag: newObs.defaultFlag,
          gamma: Number(newObs.gamma),
          loanAmount: newObs.loanAmount
            ? Number(newObs.loanAmount)
            : parentLoan?.loanAmount ?? 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddObsError(data.error ?? "Failed to add observation");
        return;
      }
      setLoans((prev) =>
        prev.map((l) =>
          l.id === loanId
            ? { ...l, observations: [...l.observations, data] }
            : l
        )
      );
      setNewObs({
        obsPeriod: "",
        obsDate: "",
        rating: "3",
        defaultFlag: false,
        gamma: latestGamma !== null ? String(latestGamma) : "-0.73",
        loanAmount: "",
      });
      setShowAddObs(null);
    } catch {
      setAddObsError("Network error — please try again.");
    } finally {
      setAddingObs(false);
    }
  }

  async function handleDeleteLoan(loanId: string) {
    if (
      !confirm(
        "Delete this loan and all its observations and ECL forecasts? This cannot be undone."
      )
    )
      return;
    const res = await fetch(`/api/admin/loans/${loanId}`, { method: "DELETE" });
    if (res.ok) {
      setLoans((prev) => prev.filter((l) => l.id !== loanId));
      if (expandedLoanId === loanId) setExpandedLoanId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Card className="border-slate-200">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            Loans &amp; Credit Risk (IFRS 9)
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setShowAddLoan((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Loan
          </Button>
        </div>
        {latestGamma !== null && (
          <p className="text-xs text-slate-400 mt-1">
            ECL will use latest satellite γ ={" "}
            <span className={`font-mono font-semibold ${gammaColor(latestGamma)}`}>
              {latestGamma.toFixed(3)}
            </span>{" "}
            from field analysis.
          </p>
        )}
        {latestGamma === null && (
          <p className="text-xs text-amber-600 mt-1">
            No field analysis found — ECL will use baseline γ = −0.73 (historical average).
          </p>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* ── Add Loan Form ─────────────────────────────────────────────── */}
        {showAddLoan && (
          <div className="p-5 border-b border-slate-100 bg-indigo-50/30">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              New Loan
            </p>
            <form
              onSubmit={handleAddLoan}
              className="grid grid-cols-2 md:grid-cols-3 gap-3"
            >
              <div>
                <Label className="text-xs">Loan Reference *</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="LN-2024-001"
                  value={newLoan.loanRef}
                  onChange={(e) =>
                    setNewLoan((p) => ({ ...p, loanRef: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Loan Amount / EAD ($) *</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="5000"
                  value={newLoan.loanAmount}
                  onChange={(e) =>
                    setNewLoan((p) => ({ ...p, loanAmount: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Current Rating (1–5) *</Label>
                <Select
                  value={newLoan.currentRating}
                  onValueChange={(v) =>
                    setNewLoan((p) => ({ ...p, currentRating: v }))
                  }
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Default / Impaired</SelectItem>
                    <SelectItem value="2">2 — High Risk</SelectItem>
                    <SelectItem value="3">3 — Moderate</SelectItem>
                    <SelectItem value="4">4 — Satisfactory</SelectItem>
                    <SelectItem value="5">5 — Strong / Best</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Disbursement Date *</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  type="date"
                  value={newLoan.disbursementDate}
                  onChange={(e) =>
                    setNewLoan((p) => ({ ...p, disbursementDate: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label className="text-xs">IFRS 9 Stage</Label>
                <Select
                  value={newLoan.stage}
                  onValueChange={(v) =>
                    setNewLoan((p) => ({ ...p, stage: v }))
                  }
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAGE_1">Stage 1 — 12-month ECL</SelectItem>
                    <SelectItem value="STAGE_2">Stage 2 — Lifetime ECL</SelectItem>
                    <SelectItem value="STAGE_3">Stage 3 — Credit-impaired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Loan Status</Label>
                <Select
                  value={newLoan.status}
                  onValueChange={(v) =>
                    setNewLoan((p) => ({ ...p, status: v }))
                  }
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DEFAULT">Default</SelectItem>
                    <SelectItem value="REPAID">Repaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3 flex items-center gap-2 pt-1">
                {addLoanError && (
                  <p className="text-xs text-red-600 flex-1">{addLoanError}</p>
                )}
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setShowAddLoan(false);
                      setAddLoanError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={addingLoan}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs"
                  >
                    {addingLoan ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Create Loan
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── Loan List ─────────────────────────────────────────────────── */}
        {loans.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <CreditCard className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400 mb-1">
              No loans recorded
            </p>
            <p className="text-xs text-slate-400">
              Add a loan above to enable IFRS 9 ECL calculation.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {loans.map((loan) => {
              const latestECL = loan.eclForecasts[0] ?? null;
              const isExpanded = expandedLoanId === loan.id;
              const isComputing = computingECL === loan.id;

              return (
                <div key={loan.id}>
                  {/* Summary row */}
                  <div className="px-5 py-4 flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {loan.loanRef}
                        </span>
                        <Badge
                          className={`${STATUS_COLORS[loan.status] ?? ""} border-none text-xs`}
                        >
                          {loan.status}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-600 border-none text-xs">
                          {STAGE_LABELS[loan.stage] ?? loan.stage}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          Rating {loan.currentRating}/5
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>
                          EAD:{" "}
                          <span className="font-semibold text-slate-700">
                            {fmtCurrency(loan.loanAmount)}
                          </span>
                        </span>
                        <span>
                          Disbursed:{" "}
                          {new Date(loan.disbursementDate).toLocaleDateString()}
                        </span>
                        <span>
                          {loan.observations.length} observation
                          {loan.observations.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {latestECL && (
                        <div className="flex items-center gap-3 text-xs">
                          <TrendingUp className="h-3 w-3 text-indigo-500" />
                          <span className="text-slate-400">1Y ECL:</span>
                          <span className="font-semibold text-indigo-700">
                            {fmtCurrency(latestECL.ecl1Year)}
                          </span>
                          <span className="text-slate-400">PD(1Q):</span>
                          <span className="font-semibold text-indigo-700">
                            {fmtPct(latestECL.onePeriodPD)}
                          </span>
                          <span className="text-slate-400">γ:</span>
                          <span
                            className={`font-mono font-semibold ${gammaColor(latestECL.currentGamma)}`}
                          >
                            {latestECL.currentGamma.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-7 px-2.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        onClick={() => handleComputeECL(loan.id)}
                        disabled={isComputing}
                      >
                        {isComputing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Calculator className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">
                          {latestECL ? "Recalculate" : "Compute ECL"}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
                        onClick={() => handleDeleteLoan(loan.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          setExpandedLoanId(isExpanded ? null : loan.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 border-t border-slate-100 px-5 py-5 space-y-5">
                      {eclError && computingECL === null && (
                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {eclError}
                        </div>
                      )}

                      {/* ECL results */}
                      {latestECL ? (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                            Latest ECL Forecast
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            {[
                              {
                                label: "1-Year ECL",
                                value: fmtCurrency(latestECL.ecl1Year),
                                color: "text-indigo-700",
                              },
                              {
                                label: "5-Year ECL",
                                value: fmtCurrency(latestECL.ecl5Year),
                                color: "text-indigo-700",
                              },
                              {
                                label: "Expected ECL",
                                value: fmtCurrency(latestECL.eclExpected),
                                color: "text-purple-700",
                              },
                              {
                                label: "PD (1 Quarter)",
                                value: fmtPct(latestECL.onePeriodPD),
                                color: "text-slate-800",
                              },
                            ].map(({ label, value, color }) => (
                              <div
                                key={label}
                                className="bg-white rounded-lg p-3 border border-slate-100"
                              >
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                                  {label}
                                </p>
                                <p className={`text-lg font-bold ${color}`}>
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Scenario strip */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                            <div className="bg-emerald-50 rounded-lg p-2.5">
                              <p className="text-slate-400 mb-0.5">
                                Baseline — 55%
                              </p>
                              <p className="font-semibold text-emerald-700">
                                {fmtCurrency(latestECL.eclBaseline)}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                γ = −0.73
                              </p>
                            </div>
                            <div className="bg-yellow-50 rounded-lg p-2.5">
                              <p className="text-slate-400 mb-0.5">
                                Mod. Drought — 25%
                              </p>
                              <p className="font-semibold text-amber-700">
                                {fmtCurrency(latestECL.eclModerateDrought)}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                γ = −1.20
                              </p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-2.5">
                              <p className="text-slate-400 mb-0.5">
                                Sev. Drought — 12%
                              </p>
                              <p className="font-semibold text-red-700">
                                {fmtCurrency(latestECL.eclSevereDrought)}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                γ = −1.80
                              </p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-2.5">
                              <p className="text-slate-400 mb-0.5">
                                Wet Recovery — 8%
                              </p>
                              <p className="font-semibold text-blue-700">
                                {fmtCurrency(latestECL.eclWetRecovery)}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                γ = +0.80
                              </p>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Computed{" "}
                            {new Date(latestECL.computedAt).toLocaleString()} ·
                            γ = {latestECL.currentGamma.toFixed(3)} · ω(γ) ={" "}
                            {latestECL.regimeWeight.toFixed(3)} · LGD ={" "}
                            {(latestECL.lgd * 100).toFixed(0)}% · r ={" "}
                            {(latestECL.discountRate * 100).toFixed(0)}%
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-xs text-slate-400 bg-white rounded-lg p-4 border border-dashed border-slate-200">
                          <Calculator className="h-5 w-5 shrink-0 text-indigo-300" />
                          <div>
                            <p className="font-medium text-slate-500">
                              No ECL computed yet
                            </p>
                            <p>
                              Click &ldquo;Compute ECL&rdquo; above to run the
                              IFRS 9 Two-Regime Markov-Switching model.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Rating observations */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Rating Observations
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-6 px-2 gap-1 text-emerald-700 hover:bg-emerald-50"
                            onClick={() =>
                              setShowAddObs(
                                showAddObs === loan.id ? null : loan.id
                              )
                            }
                          >
                            <PlusCircle className="h-3 w-3" />
                            Add Observation
                          </Button>
                        </div>

                        {showAddObs === loan.id && (
                          <form
                            onSubmit={(e) => handleAddObs(e, loan.id)}
                            className="bg-white rounded-lg p-3.5 border border-slate-100 mb-3 grid grid-cols-2 md:grid-cols-3 gap-2.5"
                          >
                            <div>
                              <Label className="text-[10px] uppercase tracking-wide text-slate-400">
                                Period (e.g. 2024Q4)
                              </Label>
                              <Input
                                className="mt-1 h-7 text-xs"
                                placeholder="2024Q4"
                                value={newObs.obsPeriod}
                                onChange={(e) =>
                                  setNewObs((p) => ({
                                    ...p,
                                    obsPeriod: e.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase tracking-wide text-slate-400">
                                Observation Date
                              </Label>
                              <Input
                                className="mt-1 h-7 text-xs"
                                type="date"
                                value={newObs.obsDate}
                                onChange={(e) =>
                                  setNewObs((p) => ({
                                    ...p,
                                    obsDate: e.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase tracking-wide text-slate-400">
                                Rating (1–5)
                              </Label>
                              <Select
                                value={newObs.rating}
                                onValueChange={(v) =>
                                  setNewObs((p) => ({ ...p, rating: v }))
                                }
                              >
                                <SelectTrigger className="mt-1 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5].map((r) => (
                                    <SelectItem key={r} value={String(r)}>
                                      {r}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase tracking-wide text-slate-400">
                                γ (SPEI-3 drought index)
                              </Label>
                              <Input
                                className="mt-1 h-7 text-xs"
                                type="number"
                                step="0.01"
                                placeholder="-0.73"
                                value={newObs.gamma}
                                onChange={(e) =>
                                  setNewObs((p) => ({
                                    ...p,
                                    gamma: e.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase tracking-wide text-slate-400">
                                Outstanding Balance ($)
                              </Label>
                              <Input
                                className="mt-1 h-7 text-xs"
                                type="number"
                                step="0.01"
                                placeholder={String(loan.loanAmount)}
                                value={newObs.loanAmount}
                                onChange={(e) =>
                                  setNewObs((p) => ({
                                    ...p,
                                    loanAmount: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="flex items-end pb-1">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newObs.defaultFlag}
                                  onChange={(e) =>
                                    setNewObs((p) => ({
                                      ...p,
                                      defaultFlag: e.target.checked,
                                    }))
                                  }
                                  className="w-3.5 h-3.5"
                                />
                                Default event at this period
                              </label>
                            </div>
                            <div className="col-span-2 md:col-span-3 flex items-center gap-2 justify-end">
                              {addObsError && (
                                <p className="text-xs text-red-600 flex-1">
                                  {addObsError}
                                </p>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7"
                                onClick={() => {
                                  setShowAddObs(null);
                                  setAddObsError(null);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                disabled={addingObs}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3 gap-1"
                              >
                                {addingObs && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                                Save Observation
                              </Button>
                            </div>
                          </form>
                        )}

                        {loan.observations.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No observations yet. Add quarterly rating observations
                            to build the credit history.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                  {[
                                    "Period",
                                    "Date",
                                    "Rating",
                                    "γ (SPEI)",
                                    "Balance",
                                    "Default",
                                  ].map((h) => (
                                    <th
                                      key={h}
                                      className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {loan.observations.map((obs) => (
                                  <tr
                                    key={obs.id}
                                    className="border-b border-slate-50 last:border-0"
                                  >
                                    <td className="px-3 py-2 font-mono font-semibold">
                                      {obs.obsPeriod}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500">
                                      {new Date(
                                        obs.obsDate
                                      ).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2 font-semibold">
                                      {obs.rating}
                                    </td>
                                    <td
                                      className={`px-3 py-2 font-mono font-semibold ${gammaColor(obs.gamma)}`}
                                    >
                                      {obs.gamma.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2">
                                      {fmtCurrency(obs.loanAmount)}
                                    </td>
                                    <td className="px-3 py-2">
                                      {obs.defaultFlag ? (
                                        <Badge className="bg-red-100 text-red-700 border-none text-[10px]">
                                          Yes
                                        </Badge>
                                      ) : (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
