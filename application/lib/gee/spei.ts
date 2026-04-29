/**
 * SPEI (Standardized Precipitation-Evapotranspiration Index)
 *
 * Supports SPEI-3, SPEI-6, and SPEI-12.
 *
 * Implements the Vicente-Serrano et al. (2010) methodology:
 *   1. Fetch historical daily precipitation + temperature from Open-Meteo archive
 *   2. Aggregate to monthly totals/means
 *   3. Compute monthly PET via Thornthwaite (1948)
 *   4. Compute water balance D = P − PET
 *   5. Accumulate `scale`-month rolling sum (D_scale)
 *   6. **Standardise against the same calendar month's historical distribution**
 *      (critical: April is ranked against other Aprils, not against all months)
 *
 * The per-calendar-month standardisation is the correct SPEI methodology and
 * removes seasonal bias. Without it, wet-season months always appear "wet" and
 * dry-season months always appear "dry" regardless of the year's actual anomaly.
 *
 * Scale guidance for credit risk use:
 *   SPEI-3  — short-term agricultural stress; sensitive to single wet/dry months
 *   SPEI-6  — covers a full growing season; balanced for annual crop loans
 *   SPEI-12 — full hydrological year; least seasonal bias; recommended for ECL
 *
 * References:
 *   Vicente-Serrano, S.M., Beguería, S. & López-Moreno, J.I. (2010)
 *   Journal of Climate, 23(7), pp. 1696–1718.
 *
 *   Thornthwaite, C.W. (1948) Geographical Review, 38(1), pp. 55–94.
 *
 * WMO (2012) classification:
 *   SPEI ≥  2.00  Extremely wet
 *   SPEI ≥  1.50  Very wet
 *   SPEI ≥  1.00  Moderately wet
 *   SPEI ≥  0.00  Normal / near-normal
 *   SPEI < −1.00  Moderately dry  (drought stress threshold in ECL model)
 *   SPEI < −1.50  Severely dry
 *   SPEI < −2.00  Extremely dry
 */

// ── Day-length lookup for −20° latitude (Zimbabwe midlands) ──────────────────
const DAYLIGHT_HOURS_NEG20: number[] = [
  13.5, 12.9, 12.3, 11.6, 10.9, 10.6,
  10.7, 11.3, 12.0, 12.6, 13.3, 13.6,
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SPEIResult {
  spei: number;
  year: number;
  month: number;
  label: string;
  scale: number;
  /** D_scale values used for the same-month standardisation reference. */
  d3Series: number[];
  monthsUsed: number;
}

interface MonthlyObs {
  year: number;
  month: number;
  precipitation: number;
  temperature: number;
}

// ── Thornthwaite PET ──────────────────────────────────────────────────────────

function heatIndex(annualTemps: number[]): number {
  return annualTemps.reduce((sum, t) => sum + (t > 0 ? Math.pow(t / 5, 1.514) : 0), 0);
}

function thornthwaitePET(
  temp: number,
  monthIdx: number,
  I: number,
  latitudeDeg: number,
): number {
  if (temp <= 0 || I === 0) return 0;

  const baseN = DAYLIGHT_HOURS_NEG20[monthIdx];
  const latFactor = 1 + (latitudeDeg - (-20)) * 0.005;
  const N = Math.max(9, Math.min(16, baseN * latFactor));

  const a =
    6.75e-7 * Math.pow(I, 3) -
    7.71e-5 * Math.pow(I, 2) +
    1.792e-2 * I +
    0.49239;

  return Math.max(0, 16 * (N / 12) * Math.pow((10 * temp) / I, a) * (DAYS_IN_MONTH[monthIdx] / 30));
}

// ── Open-Meteo historical fetch ───────────────────────────────────────────────

async function fetchHistoricalMonthly(lat: number, lng: number): Promise<MonthlyObs[]> {
  // 4 years of history ensures ≥4 same-month observations for any scale
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1);

  const startDate = new Date(today);
  startDate.setFullYear(startDate.getFullYear() - 4);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}` +
    `&daily=temperature_2m_mean,precipitation_sum` +
    `&timezone=auto`;

  const resp = await fetch(url, { next: { revalidate: 3600 } });
  if (!resp.ok) throw new Error(`Open-Meteo archive API error: ${resp.status}`);

  const json = await resp.json();
  const dates: string[] = json.daily?.time ?? [];
  const temps: (number | null)[] = json.daily?.temperature_2m_mean ?? [];
  const precips: (number | null)[] = json.daily?.precipitation_sum ?? [];

  if (dates.length === 0) throw new Error("Empty response from Open-Meteo archive");

  const monthMap: Map<string, { tempSum: number; tempCount: number; precipSum: number }> = new Map();

  for (let i = 0; i < dates.length; i++) {
    const [year, month] = dates[i].split("-").map(Number);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!monthMap.has(key)) monthMap.set(key, { tempSum: 0, tempCount: 0, precipSum: 0 });
    const entry = monthMap.get(key)!;
    const t = temps[i];
    const p = precips[i];
    if (t !== null && !isNaN(t)) { entry.tempSum += t; entry.tempCount++; }
    if (p !== null && !isNaN(p)) entry.precipSum += Math.max(0, p);
  }

  const monthly: MonthlyObs[] = [];
  for (const [key, v] of monthMap.entries()) {
    const [year, month] = key.split("-").map(Number);
    monthly.push({
      year,
      month,
      precipitation: v.precipSum,
      temperature: v.tempCount > 0 ? v.tempSum / v.tempCount : 15,
    });
  }

  return monthly.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

// ── Standard-normal approximation ────────────────────────────────────────────

function normInvCDF(p: number): number {
  const pClamped = Math.max(0.001, Math.min(0.999, p));
  const w = Math.sqrt(-2 * Math.log(pClamped <= 0.5 ? pClamped : 1 - pClamped));
  const C = [2.515517, 0.802853, 0.010328];
  const D = [1.432788, 0.189269, 0.001308];
  const z = w - (C[0] + C[1] * w + C[2] * w * w) / (1 + D[0] * w + D[1] * w * w + D[2] * w * w * w);
  return pClamped > 0.5 ? -z : z;
}

function empiricalCDF(sortedValues: number[], value: number): number {
  const n = sortedValues.length;
  let rank = 0;
  for (const v of sortedValues) if (v <= value) rank++;
  return rank / (n + 1); // Weibull plotting position
}

// ── WMO classification ────────────────────────────────────────────────────────

export function speiLabel(spei: number): string {
  if (spei >= 2.0)  return "Extremely Wet";
  if (spei >= 1.5)  return "Very Wet";
  if (spei >= 1.0)  return "Moderately Wet";
  if (spei >= 0.0)  return "Near Normal";
  if (spei >= -1.0) return "Mildly Dry";
  if (spei >= -1.5) return "Moderately Dry";
  if (spei >= -2.0) return "Severely Dry";
  return "Extremely Dry";
}

// ── Main SPEI computation ─────────────────────────────────────────────────────

/**
 * Compute SPEI at the given scale for the most recent complete month.
 *
 * @param lat    Latitude (decimal degrees; negative = Southern Hemisphere)
 * @param lng    Longitude (decimal degrees)
 * @param scale  Accumulation window in months: 3, 6, or 12 (default 12 for ECL)
 */
export async function computeSPEI(
  lat: number,
  lng: number,
  scale: 3 | 6 | 12 = 12,
): Promise<SPEIResult> {
  const monthly = await fetchHistoricalMonthly(lat, lng);

  if (monthly.length < scale + 2) {
    throw new Error(`Insufficient historical data to compute SPEI-${scale} (need ≥${scale + 2} months)`);
  }

  // ── Step 1: Thornthwaite PET ───────────────────────────────────────────────
  const monthlyMeanTemps: number[] = Array(12).fill(0);
  const monthlyCount: number[] = Array(12).fill(0);
  for (const obs of monthly) {
    monthlyMeanTemps[obs.month - 1] += obs.temperature;
    monthlyCount[obs.month - 1]++;
  }
  const annualTemps = monthlyMeanTemps.map((sum, i) =>
    monthlyCount[i] > 0 ? sum / monthlyCount[i] : 15,
  );
  const I = heatIndex(annualTemps);

  // ── Step 2: Water balance D = P − PET ─────────────────────────────────────
  const waterBalance = monthly.map(obs =>
    obs.precipitation - thornthwaitePET(obs.temperature, obs.month - 1, I, lat)
  );

  // ── Step 3: scale-month cumulative water balance ───────────────────────────
  // Each accumulated value is tagged with the calendar month it ends on.
  interface AccumEntry { val: number; calMonth: number; }
  const accumSeries: AccumEntry[] = [];

  for (let i = scale - 1; i < waterBalance.length; i++) {
    let sum = 0;
    for (let k = 0; k < scale; k++) sum += waterBalance[i - k];
    accumSeries.push({ val: sum, calMonth: monthly[i].month });
  }

  if (accumSeries.length < 2) {
    throw new Error(`Insufficient data for ${scale}-month accumulation`);
  }

  // ── Step 4: Per-calendar-month standardisation ────────────────────────────
  //
  // The key correction: rank the current month's accumulated water balance
  // ONLY against the same calendar month in prior years.
  //
  // Without this, April (naturally wet in Zimbabwe) always ranks high against
  // all months, producing a falsely positive SPEI regardless of the year's
  // actual anomaly — a systematic seasonal bias.
  //
  const current = accumSeries[accumSeries.length - 1];
  const sameMonthValues = accumSeries
    .filter(e => e.calMonth === current.calMonth)
    .map(e => e.val);

  // Require at least 2 same-month observations; fall back to full series only
  // if there is genuinely insufficient history (should not happen with 4 years).
  const reference = sameMonthValues.length >= 2 ? sameMonthValues : accumSeries.map(e => e.val);

  const sorted = [...reference].sort((a, b) => a - b);
  const p = empiricalCDF(sorted, current.val);
  const spei = normInvCDF(p);
  const speiClamped = Math.max(-3.0, Math.min(3.0, spei));

  const lastObs = monthly[monthly.length - 1];

  return {
    spei: Math.round(speiClamped * 100) / 100,
    year: lastObs.year,
    month: lastObs.month,
    label: speiLabel(speiClamped),
    scale,
    d3Series: accumSeries.map(e => e.val),
    monthsUsed: monthly.length,
  };
}
