/**
 * Agricultural Scoring + γ (SPEI) Derivation
 *
 * Computes:
 *   1. γ — the drought index. Taken directly from SPEI-3 when available (preferred);
 *          falls back to a rainfall+NDVI proxy when SPEI is unavailable.
 *   2. ω(γ) — logistic regime weight: probability of operating in drought-stress regime.
 *   3. Agricultural Score (0–100) — field-level health from NDVI + weather signals.
 *
 * SPEI reference:
 *   Vicente-Serrano, S.M., Beguería, S. & López-Moreno, J.I. (2010)
 *   Journal of Climate, 23(7), pp. 1696–1718.
 *
 * Model parameters from dissertation §4.4:
 *   κ = 1.25, γ₀ = −1.10
 */

import type { SatelliteData } from "@/lib/gee/satellite";

// ── Model Parameters ───────────────────────────────────────────────────────
const KAPPA = 1.25;   // logistic switching sharpness (bootstrap CI: [0.92, 1.58])
const GAMMA0 = -1.10; // drought threshold (bootstrap CI: [−1.38, −0.82])

// Fallback proxy baselines (Zimbabwe smallholder, 14-day window)
const REF_RAINFALL_MM = 50;
const REF_RAINFALL_STD = 30;
const REF_NDVI = 0.42;
const REF_NDVI_STD = 0.18;

// ── Regime Weight ──────────────────────────────────────────────────────────
/**
 * ω(γ) = 1 / (1 + exp(−κ(γ − γ₀)))
 *
 * ω → 1 : drought-stress regime dominant
 * ω → 0 : normal/wet regime dominant
 */
export function computeRegimeWeight(gamma: number): number {
  return 1 / (1 + Math.exp(-KAPPA * (gamma - GAMMA0)));
}

// ── γ Derivation ───────────────────────────────────────────────────────────
/**
 * Derive γ (drought index) from satellite data.
 *
 * Primary:  Use SPEI-3 directly from Open-Meteo archive if available.
 *           SPEI is the authentic drought index used in the research paper.
 *
 * Fallback: When SPEI is unavailable (API error, insufficient history),
 *           derive a SPEI-proxy from 14-day rainfall and NDVI anomalies.
 *           γ_proxy = 0.60·z_rain + 0.40·z_ndvi, clamped to [−3, +3].
 *
 * @returns  γ ∈ [−3, +3]  (negative = drought, positive = wet)
 */
export function computeGamma(data: SatelliteData): number {
  // Use real SPEI-3 when it has been successfully computed
  if (data.spei_result !== null && data.spei !== 0) {
    return Math.max(-3, Math.min(3, data.spei));
  }

  // Fallback proxy
  const zRain = (data.total_rainfall_mm - REF_RAINFALL_MM) / REF_RAINFALL_STD;
  const zNdvi = (data.mean_ndvi - REF_NDVI) / REF_NDVI_STD;
  const gamma = 0.60 * zRain + 0.40 * zNdvi;
  return Math.max(-3, Math.min(3, gamma));
}

// ── Agricultural Score ─────────────────────────────────────────────────────
/**
 * Score (0–100) breakdown:
 *   NDVI component      40 pts  — linear 0.10→0.90 maps to 0→40
 *   Rainfall component  25 pts  — optimal 40–80 mm/14 days
 *   Temperature         20 pts  — optimal 18–28 °C
 *   NDVI Trend          10 pts  — positive trend = more points
 *   Risk penalties       up to −25 pts
 */
export function computeAgriculturalScore(data: SatelliteData): number {
  // 1. NDVI (40 pts)
  const ndviScore = Math.max(0, Math.min(40, ((data.mean_ndvi - 0.1) / 0.8) * 40));

  // 2. Rainfall (25 pts) — penalise drought and waterlogging
  const rain = data.total_rainfall_mm;
  let rainScore: number;
  if (rain >= 40 && rain <= 80) {
    rainScore = 25;
  } else if (rain < 40) {
    rainScore = Math.max(0, (rain / 40) * 25);
  } else {
    rainScore = Math.max(0, 25 - ((rain - 80) / 80) * 25);
  }

  // 3. Temperature (20 pts)
  const temp = data.avg_temperature_c;
  let tempScore: number;
  if (temp >= 18 && temp <= 28) {
    tempScore = 20;
  } else if (temp < 18) {
    tempScore = Math.max(0, ((temp - 5) / 13) * 20);
  } else {
    tempScore = Math.max(0, 20 - ((temp - 28) / 12) * 20);
  }

  // 4. NDVI trend (10 pts)
  const trend = data.ndvi_trend;
  let trendScore: number;
  if (trend >= 0.02) trendScore = 10;
  else if (trend >= 0) trendScore = 7;
  else if (trend >= -0.02) trendScore = 4;
  else trendScore = 0;

  // 5. Risk penalties
  let penalty = 0;
  if (data.mean_ndvi < 0.15) penalty += 10;  // very low vegetation
  if (rain < 10) penalty += 8;               // extreme drought
  if (temp > 38 || temp < 5) penalty += 7;   // extreme temperature

  // 6. SPEI adjustment: if drought index is severe, nudge score down
  const spei = data.spei;
  if (spei < -1.5) penalty += 8;             // severe / extreme drought
  else if (spei < -1.0) penalty += 4;        // moderate drought

  const raw = ndviScore + rainScore + tempScore + trendScore - penalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ── Health Status ──────────────────────────────────────────────────────────
export function deriveHealthStatus(score: number): "HEALTHY" | "MODERATE_STRESS" | "HIGH_STRESS" {
  if (score >= 65) return "HEALTHY";
  if (score >= 40) return "MODERATE_STRESS";
  return "HIGH_STRESS";
}

// ── NDVI Trend enum ────────────────────────────────────────────────────────
export function deriveNdviTrend(trend: number): "IMPROVING" | "STABLE" | "DECLINING" {
  if (trend > 0.01) return "IMPROVING";
  if (trend < -0.01) return "DECLINING";
  return "STABLE";
}
