/**
 * Agricultural Scoring + γ Proxy Derivation
 *
 * Computes:
 *   1. Agricultural Score (0–100) from satellite + weather signals
 *   2. γ (drought proxy, SPEI-like) used to drive the Markov-Switching ECL model
 *   3. Logistic regime weight ω(γ) = 1 / (1 + exp(−κ(γ − γ₀)))
 *
 * References: Research document §4.3 and Application.md Phase 6.
 */

import type { SatelliteData } from "@/lib/gee/satellite";

// ── Model Parameters ──────────────────────────────────────────────────────────
const KAPPA = 1.25;
const GAMMA0 = -1.10;

// Zimbabwe agricultural baselines (14-day window used by Open-Meteo call)
const REF_RAINFALL_MM = 50;   // ~100 mm/month growing season average
const REF_RAINFALL_STD = 30;  // typical inter-period std deviation
const REF_NDVI = 0.42;        // baseline agricultural NDVI for smallholders
const REF_NDVI_STD = 0.18;    // typical NDVI spread

// ── Regime Weight ─────────────────────────────────────────────────────────────
export function computeRegimeWeight(gamma: number): number {
  return 1 / (1 + Math.exp(-KAPPA * (gamma - GAMMA0)));
}

// ── γ Proxy ───────────────────────────────────────────────────────────────────
/**
 * Derive a SPEI-like drought proxy from satellite + weather data.
 *  γ < 0  → drier than normal (drought stress)
 *  γ > 0  → wetter than normal (good growing conditions)
 *
 * Formula:
 *   z_rain = (rainfall − ref_rain) / ref_std
 *   z_ndvi = (mean_ndvi − ref_ndvi) / ref_ndvi_std
 *   γ = 0.60 · z_rain + 0.40 · z_ndvi
 * Clamped to [−3, +3].
 */
export function computeGamma(data: SatelliteData): number {
  const zRain = (data.total_rainfall_mm - REF_RAINFALL_MM) / REF_RAINFALL_STD;
  const zNdvi = (data.mean_ndvi - REF_NDVI) / REF_NDVI_STD;
  const gamma = 0.60 * zRain + 0.40 * zNdvi;
  return Math.max(-3, Math.min(3, gamma));
}

// ── Agricultural Score ─────────────────────────────────────────────────────────
/**
 * Score (0–100) breakdown:
 *   NDVI component      40 pts  — linear 0.10→0.90 maps to 0→40
 *   Rainfall component  25 pts  — optimal 40–80 mm/14 days
 *   Temperature         20 pts  — optimal 18–28 °C
 *   NDVI Trend          10 pts  — positive trend = more points
 *   Risk penalties       up to −15 pts (waterStress, extreme conditions)
 */
export function computeAgriculturalScore(data: SatelliteData): number {
  // 1. NDVI component (40 pts)
  const ndviScore = Math.max(0, Math.min(40, ((data.mean_ndvi - 0.1) / 0.8) * 40));

  // 2. Rainfall component (25 pts) — penalise both drought and flood
  const rain = data.total_rainfall_mm;
  let rainScore: number;
  if (rain >= 40 && rain <= 80) {
    rainScore = 25; // optimal range
  } else if (rain < 40) {
    rainScore = Math.max(0, (rain / 40) * 25);
  } else {
    // > 80 mm — waterlogging risk, linearly decreasing
    rainScore = Math.max(0, 25 - ((rain - 80) / 80) * 25);
  }

  // 3. Temperature component (20 pts)
  const temp = data.avg_temperature_c;
  let tempScore: number;
  if (temp >= 18 && temp <= 28) {
    tempScore = 20;
  } else if (temp < 18) {
    tempScore = Math.max(0, ((temp - 5) / 13) * 20);
  } else {
    // > 28 °C — heat stress
    tempScore = Math.max(0, 20 - ((temp - 28) / 12) * 20);
  }

  // 4. NDVI trend component (10 pts)
  const trend = data.ndvi_trend;
  let trendScore: number;
  if (trend >= 0.02) {
    trendScore = 10;
  } else if (trend >= 0) {
    trendScore = 7;
  } else if (trend >= -0.02) {
    trendScore = 4;
  } else {
    trendScore = 0;
  }

  // 5. Risk penalties
  let penalty = 0;
  if (data.mean_ndvi < 0.15) penalty += 10; // very low vegetation
  if (rain < 10) penalty += 8;             // extreme drought
  if (temp > 38 || temp < 5) penalty += 7;  // extreme temperature

  const raw = ndviScore + rainScore + tempScore + trendScore - penalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ── Health Status ─────────────────────────────────────────────────────────────
export function deriveHealthStatus(score: number): "HEALTHY" | "MODERATE_STRESS" | "HIGH_STRESS" {
  if (score >= 65) return "HEALTHY";
  if (score >= 40) return "MODERATE_STRESS";
  return "HIGH_STRESS";
}

// ── NDVI Trend enum ───────────────────────────────────────────────────────────
export function deriveNdviTrend(trend: number): "IMPROVING" | "STABLE" | "DECLINING" {
  if (trend > 0.01) return "IMPROVING";
  if (trend < -0.01) return "DECLINING";
  return "STABLE";
}
