/**
 * IFRS 9 ECL Engine — Two-Regime Markov-Switching Model
 *
 * Model:
 *   P(γ) = ω(γ)·M_stress + (1−ω(γ))·M_normal
 *   ω(γ) = 1 / (1 + exp(−κ(γ − γ₀)))   κ=1.25, γ₀=−1.10
 *
 * ECL(h) = Σ_{t=1}^{h} DF(t) · EAD · LGD · marginalPD(t)
 *   LGD = 45%,  r = 5%,  DF(t) = 1/(1+r)^(t/4)   (quarterly)
 *
 * Scenario γ values (IFRS 9 §IE82):
 *   Baseline          γ = −0.73  p = 55%
 *   Moderate Drought  γ = −1.20  p = 25%
 *   Severe Drought    γ = −1.80  p = 12%
 *   Wet Recovery      γ = +0.80  p =  8%
 *
 * References: Research document Chapter 4.
 */

import { prisma } from "@/lib/prisma";
import { computeRegimeWeight } from "@/lib/analysis/scoring";

const LGD = 0.45;
const DISCOUNT_RATE = 0.05;

// ── Scenario definitions ─────────────────────────────────────────────────────
const SCENARIOS = [
  { name: "baseline",        gamma: -0.73, prob: 0.55 },
  { name: "moderateDrought", gamma: -1.20, prob: 0.25 },
  { name: "severeDrought",   gamma: -1.80, prob: 0.12 },
  { name: "wetRecovery",     gamma:  0.80, prob: 0.08 },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Blend M_normal and M_stress by regime weight ω */
function blendMatrix(mNormal: number[][], mStress: number[][], omega: number): number[][] {
  return mNormal.map((row, i) =>
    row.map((v, j) => (1 - omega) * v + omega * mStress[i][j])
  );
}

/** Raise a transition matrix to the power n (matrix exponentiation, n integer ≥ 1) */
function matPow(m: number[][], n: number): number[][] {
  const size = m.length;
  // Start with identity
  let result: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i === j ? 1 : 0))
  );
  let base = m.map((row) => [...row]);
  let exp = n;
  while (exp > 0) {
    if (exp % 2 === 1) result = matMul(result, base);
    base = matMul(base, base);
    exp = Math.floor(exp / 2);
  }
  return result;
}

function matMul(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  return a.map((row, i) =>
    b[0].map((_, j) =>
      row.reduce((sum, _, k) => sum + a[i][k] * b[k][j], 0)
    )
  );
}

/** Compute marginal PD sequence for `horizons` quarters given a starting rating (1-indexed). */
function marginalPDs(
  blended: number[][],
  startRating: number, // 1–5
  horizons: number
): number[] {
  // Row index is (startRating − 1); column 0 (rating 1) is the default absorbing state.
  const stateIdx = startRating - 1;
  const pds: number[] = [];

  // P_t = P^t (t-step transition matrix)
  // marginalPD(t) = P_t[stateIdx][0] − P_{t-1}[stateIdx][0]
  let prevDefaultProb = stateIdx === 0 ? 1.0 : 0.0; // already in default
  for (let t = 1; t <= horizons; t++) {
    const Pt = matPow(blended, t);
    const cumDefaultProb = Pt[stateIdx][0];
    pds.push(Math.max(0, cumDefaultProb - prevDefaultProb));
    prevDefaultProb = cumDefaultProb;
  }
  return pds;
}

/** Compute sum of discounted ECL over `quarters` quarters. */
function discountedECL(
  mPDs: number[],
  ead: number,
  quarters: number
): number {
  let ecl = 0;
  for (let t = 1; t <= quarters; t++) {
    const df = 1 / Math.pow(1 + DISCOUNT_RATE, t / 4);
    ecl += df * ead * LGD * mPDs[t - 1];
  }
  return ecl;
}

// ── Main ECL computation ──────────────────────────────────────────────────────
export interface ECLResult {
  currentGamma: number;
  regimeWeight: number;
  onePeriodPD: number;
  ecl1Year: number;
  ecl5Year: number;
  eclBaseline: number;
  eclModerateDrought: number;
  eclSevereDrought: number;
  eclWetRecovery: number;
  eclExpected: number;
  lgd: number;
  discountRate: number;
}

export async function computeECL(
  loanId: string,
  gamma: number
): Promise<ECLResult> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error(`Loan ${loanId} not found`);

  const [mxNormal, mxStress] = await Promise.all([
    prisma.migrationMatrix.findFirst({ where: { matrixType: "NORMAL" } }),
    prisma.migrationMatrix.findFirst({ where: { matrixType: "STRESS" } }),
  ]);
  if (!mxNormal || !mxStress) throw new Error("Migration matrices not seeded");

  const mNormal: number[][] = JSON.parse(mxNormal.matrixData);
  const mStress: number[][] = JSON.parse(mxStress.matrixData);

  const ead = loan.loanAmount;
  const rating = loan.currentRating; // 1–5

  // ── Current γ ECL ──────────────────────────────────────────────────────────
  const omega = computeRegimeWeight(gamma);
  const blended = blendMatrix(mNormal, mStress, omega);

  const mPDs20 = marginalPDs(blended, rating, 20);
  const onePeriodPD = mPDs20[0]; // quarter-1 marginal PD
  const ecl1Year = discountedECL(mPDs20.slice(0, 4), ead, 4);
  const ecl5Year = discountedECL(mPDs20, ead, 20);

  // ── Scenario ECLs ─────────────────────────────────────────────────────────
  function scenarioECL(scenGamma: number): number {
    const w = computeRegimeWeight(scenGamma);
    const b = blendMatrix(mNormal, mStress, w);
    const pds = marginalPDs(b, rating, 4); // 1-year for scenario
    return discountedECL(pds, ead, 4);
  }

  const eclBaseline        = scenarioECL(SCENARIOS[0].gamma);
  const eclModerateDrought = scenarioECL(SCENARIOS[1].gamma);
  const eclSevereDrought   = scenarioECL(SCENARIOS[2].gamma);
  const eclWetRecovery     = scenarioECL(SCENARIOS[3].gamma);

  const eclExpected =
    eclBaseline        * SCENARIOS[0].prob +
    eclModerateDrought * SCENARIOS[1].prob +
    eclSevereDrought   * SCENARIOS[2].prob +
    eclWetRecovery     * SCENARIOS[3].prob;

  return {
    currentGamma: gamma,
    regimeWeight: omega,
    onePeriodPD,
    ecl1Year,
    ecl5Year,
    eclBaseline,
    eclModerateDrought,
    eclSevereDrought,
    eclWetRecovery,
    eclExpected,
    lgd: LGD,
    discountRate: DISCOUNT_RATE,
  };
}

/** Persist an ECLForecast record (and return it). */
export async function saveECLForecast(loanId: string, result: ECLResult) {
  return prisma.eCLForecast.create({
    data: { loanId, ...result },
  });
}
