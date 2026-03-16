/**
 * SPEI-3 (Standardized Precipitation-Evapotranspiration Index, 3-month)
 *
 * Implements the Vicente-Serrano et al. (2010) SPEI methodology:
 *   1. Fetch 36+ months of daily precipitation + temperature from Open-Meteo archive
 *   2. Aggregate to monthly totals/means
 *   3. Compute monthly PET via Thornthwaite (1948) method
 *   4. Compute water balance D = P − PET
 *   5. Accumulate 3-month rolling D (D₃)
 *   6. Standardise D₃ using z-score over the historical series → SPEI
 *
 * References:
 *   Vicente-Serrano, S.M., Beguería, S. & López-Moreno, J.I. (2010)
 *   'A multiscalar drought index sensitive to global warming: The SPEI',
 *   Journal of Climate, 23(7), pp. 1696–1718.
 *
 *   Thornthwaite, C.W. (1948) 'An approach toward a rational classification
 *   of climate', Geographical Review, 38(1), pp. 55–94.
 *
 * Classification (WMO, 2012):
 *   SPEI ≥  2.00  →  Extremely wet
 *   SPEI ≥  1.50  →  Very wet
 *   SPEI ≥  1.00  →  Moderately wet
 *   SPEI ≥  0.00  →  Normal / near-normal
 *   SPEI < −1.00  →  Moderately dry (drought stress threshold used in model)
 *   SPEI < −1.50  →  Severely dry
 *   SPEI < −2.00  →  Extremely dry
 */

// ── Day-length correction table (mean daylight hours by month for −20° lat) ──
// Computed from astronomical formula; representative for Zimbabwe's midlands.
const DAYLIGHT_HOURS_NEG20: number[] = [
  13.5, // Jan
  12.9, // Feb
  12.3, // Mar
  11.6, // Apr
  10.9, // May
  10.6, // Jun
  10.7, // Jul
  11.3, // Aug
  12.0, // Sep
  12.6, // Oct
  13.3, // Nov
  13.6, // Dec
];

/** Days in each month (non-leap year; good enough for monthly aggregation). */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface SPEIResult {
  /** Current SPEI-3 value (γ). Negative = drought; positive = wet. */
  spei: number;
  /** Observation year for the current SPEI value. */
  year: number;
  /** Observation month (1-based) for the current SPEI value. */
  month: number;
  /** Label matching WMO classification. */
  label: string;
  /** All monthly D₃ (3-month cumulative water balance) values used for standardisation. */
  d3Series: number[];
  /** Number of monthly observations used. */
  monthsUsed: number;
}

interface MonthlyObs {
  year: number;
  month: number; // 1-based
  precipitation: number; // mm total
  temperature: number;   // °C mean
}

// ── Thornthwaite PET ─────────────────────────────────────────────────────────

/**
 * Compute annual heat index I from a full 12-month temperature series.
 * I = Σ_{m=1}^{12} (T_m / 5)^1.514   for T_m > 0
 */
function heatIndex(annualTemps: number[]): number {
  return annualTemps.reduce((sum, t) => sum + (t > 0 ? Math.pow(t / 5, 1.514) : 0), 0);
}

/**
 * Thornthwaite PET for a single month (mm).
 *
 * PET = 16 × (N/12) × (10 × T / I)^a × (d/30)
 *
 * where N = mean daylight hours for that month at the site latitude,
 *       d = number of days in the month,
 *       I = annual heat index,
 *       a = cubic polynomial in I.
 *
 * Returns 0 if T ≤ 0 (no evapotranspiration below freezing).
 */
function thornthwaitePET(
  temp: number,
  monthIdx: number, // 0-based
  I: number,
  latitudeDeg: number,
): number {
  if (temp <= 0 || I === 0) return 0;

  // Daylight hours: interpolate or use lookup for ≈−20° (Zimbabwe midlands).
  // For other latitudes we scale linearly: at equator all months ≈12h.
  const baseN = DAYLIGHT_HOURS_NEG20[monthIdx];
  // Simple latitude scaling: difference from −20° reduces/increases day length
  const latFactor = 1 + (latitudeDeg - (-20)) * 0.005; // rough linear adjustment
  const N = Math.max(9, Math.min(16, baseN * latFactor));

  const a =
    6.75e-7 * Math.pow(I, 3) -
    7.71e-5 * Math.pow(I, 2) +
    1.792e-2 * I +
    0.49239;

  const pet =
    16 * (N / 12) * Math.pow((10 * temp) / I, a) * (DAYS_IN_MONTH[monthIdx] / 30);

  return Math.max(0, pet);
}

// ── Open-Meteo historical fetch ───────────────────────────────────────────────

async function fetchHistoricalMonthly(
  lat: number,
  lng: number,
): Promise<MonthlyObs[]> {
  // Fetch 3 years + 3 months of daily data for a robust SPEI-3 baseline.
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // yesterday (archive data)

  const startDate = new Date(today);
  startDate.setFullYear(startDate.getFullYear() - 3);
  startDate.setMonth(startDate.getMonth() - 3);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}` +
    `&daily=temperature_2m_mean,precipitation_sum` +
    `&timezone=auto`;

  const resp = await fetch(url, { next: { revalidate: 3600 } });
  if (!resp.ok) {
    throw new Error(`Open-Meteo archive API error: ${resp.status}`);
  }

  const json = await resp.json();
  const dates: string[] = json.daily?.time ?? [];
  const temps: (number | null)[] = json.daily?.temperature_2m_mean ?? [];
  const precips: (number | null)[] = json.daily?.precipitation_sum ?? [];

  if (dates.length === 0) throw new Error("Empty response from Open-Meteo archive");

  // ── Aggregate daily → monthly ─────────────────────────────────────────────
  const monthMap: Map<string, { tempSum: number; tempCount: number; precipSum: number }> =
    new Map();

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

/** Rational approximation of the inverse normal CDF (Abramowitz & Stegun). */
function normInvCDF(p: number): number {
  // Clamp to avoid infinite values
  const pClamped = Math.max(0.001, Math.min(0.999, p));
  const w = Math.sqrt(-2 * Math.log(pClamped <= 0.5 ? pClamped : 1 - pClamped));
  const C = [2.515517, 0.802853, 0.010328];
  const D = [1.432788, 0.189269, 0.001308];
  const z =
    w - (C[0] + C[1] * w + C[2] * w * w) / (1 + D[0] * w + D[1] * w * w + D[2] * w * w * w);
  return pClamped > 0.5 ? -z : z;
}

/** Empirical CDF rank (Weibull plotting position). */
function empiricalCDF(sortedD3: number[], value: number): number {
  const n = sortedD3.length;
  // Count values ≤ value
  let rank = 0;
  for (const v of sortedD3) if (v <= value) rank++;
  return rank / (n + 1); // Weibull formula
}

// ── WMO classification ────────────────────────────────────────────────────────

export function speiLabel(spei: number): string {
  if (spei >= 2.0) return "Extremely Wet";
  if (spei >= 1.5) return "Very Wet";
  if (spei >= 1.0) return "Moderately Wet";
  if (spei >= 0.0) return "Near Normal";
  if (spei >= -1.0) return "Mildly Dry";
  if (spei >= -1.5) return "Moderately Dry";
  if (spei >= -2.0) return "Severely Dry";
  return "Extremely Dry";
}

// ── Main SPEI computation ─────────────────────────────────────────────────────

/**
 * Compute SPEI-3 for the most recent complete month at the given location.
 *
 * @param lat  Latitude (decimal degrees, negative = Southern Hemisphere)
 * @param lng  Longitude (decimal degrees)
 * @returns    SPEIResult with current SPEI value and supporting metadata
 */
export async function computeSPEI(lat: number, lng: number): Promise<SPEIResult> {
  const monthly = await fetchHistoricalMonthly(lat, lng);

  if (monthly.length < 6) {
    throw new Error("Insufficient historical data to compute SPEI (need ≥6 months)");
  }

  // ── Step 1: Thornthwaite PET ───────────────────────────────────────────────
  // Use the full series mean annual temperatures for heat index calculation.
  // Group by month to get mean temperature per calendar month.
  const monthlyMeanTemps: number[] = Array(12).fill(0);
  const monthlyCount: number[] = Array(12).fill(0);
  for (const obs of monthly) {
    const mi = obs.month - 1; // 0-based
    monthlyMeanTemps[mi] += obs.temperature;
    monthlyCount[mi]++;
  }
  const annualTemps = monthlyMeanTemps.map((sum, i) =>
    monthlyCount[i] > 0 ? sum / monthlyCount[i] : 15,
  );

  const I = heatIndex(annualTemps);

  // ── Step 2: Water balance D = P − PET ────────────────────────────────────
  const waterBalance: number[] = monthly.map(obs => {
    const pet = thornthwaitePET(obs.temperature, obs.month - 1, I, lat);
    return obs.precipitation - pet;
  });

  // ── Step 3: 3-month cumulative water balance (D₃) ─────────────────────────
  const d3Series: number[] = [];
  for (let i = 2; i < waterBalance.length; i++) {
    d3Series.push(waterBalance[i] + waterBalance[i - 1] + waterBalance[i - 2]);
  }

  if (d3Series.length < 3) {
    throw new Error("Insufficient data for 3-month accumulation");
  }

  // ── Step 4: Standardise via empirical CDF → standard-normal transform ─────
  const sorted = [...d3Series].sort((a, b) => a - b);
  const currentD3 = d3Series[d3Series.length - 1];
  const p = empiricalCDF(sorted, currentD3);
  const spei = normInvCDF(p);

  // Clamp to physical SPEI range
  const speiClamped = Math.max(-3.0, Math.min(3.0, spei));

  const lastObs = monthly[monthly.length - 1];

  return {
    spei: Math.round(speiClamped * 100) / 100,
    year: lastObs.year,
    month: lastObs.month,
    label: speiLabel(speiClamped),
    d3Series,
    monthsUsed: monthly.length,
  };
}
