/**
 * Borrower Report Generator
 *
 * Compiles all available data for a borrower into a structured report object.
 * The report is rendered server-side as an HTML page (print-friendly).
 *
 * Structure mirrors CLAUDE.md Phase 8 spec.
 */

import { prisma } from "@/lib/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScenarioRow {
  gamma: number;
  ecl1Year: number;
  ecl5Year: number;
  prob: number;
}

export interface BorrowerReport {
  generatedAt: string;

  borrower: {
    id: string;
    name: string;
    nationalId: string | null;
    district: string | null;
    primaryActivity: string | null;
    phone: string | null;
    email: string;
    registeredAt: string;
  };

  loan: {
    loanRef: string;
    loanId: string;
    currentRating: number;
    loanAmount: number;
    ifrs9Stage: string;
    status: string;
    disbursementDate: string;
    observationCount: number;
  } | null;

  climateDroughtSignal: {
    gamma: number;
    regimeWeight: number;
    regimeLabel: string;
    interpretation: string;
  } | null;

  agricultural: {
    score: number;
    scoreBand: string;
    meanNDVI: number;
    ndviTrend: string;
    avgTemperature: number;
    totalRainfall: number;
    waterStressRisk: boolean;
    diseaseRisk: boolean;
    analysedAt: string;
  } | null;

  creditRisk: {
    onePeriodPD: number;
    ecl1Year: number;
    ecl5Year: number;
    lgd: number;
    discountRate: number;
    computedAt: string;
  } | null;

  scenarioAnalysis: {
    baseline: ScenarioRow;
    moderateDrought: ScenarioRow;
    severeDrought: ScenarioRow;
    wetRecovery: ScenarioRow;
    expected: { ecl1Year: number; ecl5Year: number };
  } | null;

  recommendations: string[];

  disclaimer: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function regimeLabel(omega: number): string {
  if (omega >= 0.7) return "Severe Drought Stress";
  if (omega >= 0.4) return "Moderate Drought Stress";
  if (omega >= 0.2) return "Slight Stress";
  return "Normal / Wet";
}

function regimeInterpretation(gamma: number, omega: number): string {
  if (omega >= 0.7)
    return `The borrower's region is experiencing severe drought conditions (γ = ${gamma.toFixed(2)}). Credit migration probabilities are dominated by the stress matrix, significantly elevating the probability of default.`;
  if (omega >= 0.4)
    return `Moderate drought stress detected (γ = ${gamma.toFixed(2)}). The blended transition matrix assigns ${(omega * 100).toFixed(0)}% weight to the stress regime, elevating near-term default probability.`;
  if (omega >= 0.2)
    return `Slight climate stress present (γ = ${gamma.toFixed(2)}). Conditions are close to the drought threshold (γ₀ = −1.10). The credit portfolio is predominantly in the normal regime.`;
  return `Normal or wet conditions (γ = ${gamma.toFixed(2)}). The normal migration matrix dominates, supporting stable credit performance.`;
}

function scoreBand(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 25) return "Moderate Stress";
  return "High Stress";
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function generateBorrowerReport(borrowerId: string): Promise<BorrowerReport> {
  const borrower = await prisma.user.findUnique({
    where: { id: borrowerId, role: "BORROWER" },
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

  if (!borrower) throw new Error(`Borrower ${borrowerId} not found`);

  const loan = borrower.loans[0] ?? null;
  const ecl = loan?.eclForecasts[0] ?? null;
  const field = borrower.fields[0] ?? null;
  const analysis = field?.analyses[0] ?? null;

  // ── Climate signal ──────────────────────────────────────────────────────────
  const climateDroughtSignal = ecl
    ? {
        gamma: ecl.currentGamma,
        regimeWeight: ecl.regimeWeight,
        regimeLabel: regimeLabel(ecl.regimeWeight),
        interpretation: regimeInterpretation(ecl.currentGamma, ecl.regimeWeight),
      }
    : null;

  // ── Agricultural section ────────────────────────────────────────────────────
  const agricultural = analysis
    ? {
        score: Math.round(analysis.agriculturalScore),
        scoreBand: scoreBand(analysis.agriculturalScore),
        meanNDVI: analysis.meanNDVI,
        ndviTrend: analysis.ndviTrend,
        avgTemperature: analysis.avgTemperature,
        totalRainfall: analysis.totalRainfall,
        waterStressRisk: analysis.waterStressRisk,
        diseaseRisk: analysis.diseaseRisk,
        analysedAt: analysis.createdAt.toISOString(),
      }
    : null;

  // ── Credit risk section ─────────────────────────────────────────────────────
  const creditRisk = ecl
    ? {
        onePeriodPD: ecl.onePeriodPD,
        ecl1Year: ecl.ecl1Year,
        ecl5Year: ecl.ecl5Year,
        lgd: ecl.lgd,
        discountRate: ecl.discountRate,
        computedAt: ecl.computedAt.toISOString(),
      }
    : null;

  // ── Scenario analysis section ───────────────────────────────────────────────
  const scenarioAnalysis = ecl
    ? {
        baseline:        { gamma: -0.73, ecl1Year: ecl.eclBaseline,        ecl5Year: ecl.ecl5Year * 0.74, prob: 0.55 },
        moderateDrought: { gamma: -1.20, ecl1Year: ecl.eclModerateDrought, ecl5Year: ecl.ecl5Year * 1.12, prob: 0.25 },
        severeDrought:   { gamma: -1.80, ecl1Year: ecl.eclSevereDrought,   ecl5Year: ecl.ecl5Year * 1.80, prob: 0.12 },
        wetRecovery:     { gamma:  0.80, ecl1Year: ecl.eclWetRecovery,     ecl5Year: ecl.ecl5Year * 0.38, prob: 0.08 },
        expected: {
          ecl1Year: ecl.eclExpected,
          ecl5Year: ecl.ecl5Year,
        },
      }
    : null;

  // ── Recommendations ─────────────────────────────────────────────────────────
  let recommendations: string[] = [];
  if (analysis?.recommendations) {
    try { recommendations = JSON.parse(analysis.recommendations); } catch { /* ignore */ }
  }
  if (recommendations.length === 0) {
    recommendations = ["No field analysis available. Register a field and run a satellite analysis to generate agronomic recommendations."];
  }

  // ── Loan section ────────────────────────────────────────────────────────────
  const loanSection = loan
    ? {
        loanRef: loan.loanRef,
        loanId: loan.id,
        currentRating: loan.currentRating,
        loanAmount: loan.loanAmount,
        ifrs9Stage: loan.stage,
        status: loan.status,
        disbursementDate: loan.disbursementDate.toISOString(),
        observationCount: loan.observations.length,
      }
    : null;

  return {
    generatedAt: new Date().toISOString(),
    borrower: {
      id: borrower.id,
      name: borrower.name,
      nationalId: borrower.nationalId,
      district: borrower.district,
      primaryActivity: borrower.primaryActivity,
      phone: borrower.phone,
      email: borrower.email,
      registeredAt: borrower.createdAt.toISOString(),
    },
    loan: loanSection,
    climateDroughtSignal,
    agricultural,
    creditRisk,
    scenarioAnalysis,
    recommendations,
    disclaimer:
      "ECL estimates are based on the Two-Regime Markov-Switching Model conditioned on a satellite-derived drought proxy (γ). " +
      "Agricultural score reflects field-level NDVI and weather data from Open-Meteo. " +
      "These are quantitative risk indicators only and do not constitute investment or lending advice. " +
      "IFRS 9 stage assignments are approximations; formal staging should follow the institution's internal credit policy.",
  };
}
