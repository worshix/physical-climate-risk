# CLAUDE.md — Physical Climate Risk Application: Implementation Plan

## Project Context & Research Background

This application operationalises the research in `document/document.tex`:

**"Modelling Physical Climate Risk in IFRS 9 ECL Frameworks: A Two-Regime Markov-Switching Approach to Credit Migration in Zimbabwe's Microfinance Sector"**

The research develops an **Exogenous Two-Regime Markov-Switching Model** where credit migration probabilities are conditioned on a drought index (γ = SPEI). Two distinct 5×5 migration matrices are estimated:
- **M_normal**: transitions under normal/wet conditions (γ ≥ −1.0)
- **M_stress**: transitions under drought/stress conditions (γ < −1.0)

The blended matrix: **P(γ) = ω(γ) · M_stress + (1 − ω(γ)) · M_normal**

Where the logistic regime weight: **ω(γ) = 1 / (1 + exp(−κ(γ − γ₀)))**

This produces dynamic, forward-looking **ECL (Expected Credit Loss)** estimates compliant with IFRS 9, incorporating physical climate risk.

---

## What the Application Must Do

The application is a **web-based tool for MFI (Microfinance Institution) credit officers**. It:

1. Manages **borrower profiles** (farmers/informal sector clients)
2. Assigns **credit ratings** (1–5 scale; 1 = default, 5 = best)
3. Fetches **satellite + weather data** to derive the **agricultural/climate score (γ proxy)** for each borrower's district
4. Runs the **Two-Regime Markov-Switching model** to compute:
   - Regime weight ω(γ) → degree of drought stress
   - One-period PD per rating under current γ
   - Lifetime ECL (IFRS 9 compliant)
5. Generates **per-borrower reports** with full ECL breakdown
6. Shows **portfolio-level ECL** across scenarios (baseline, moderate drought, severe drought, wet/recovery)
7. Is managed by a **single admin** (credit officer); borrowers can optionally view read-only data

The **agricultural score from satellite NDVI** serves as the observable input that informs or validates the γ (drought index) for the borrower's location — bridging the satellite-based agri analysis to the credit risk model.

---

## Core Domain Concepts (from document)

| Concept | Value |
|---------|-------|
| Rating scale | 1 (default/worst) → 5 (best) |
| Default state | Rating 1 is absorbing (once default, stays default) |
| Drought threshold | γ₀ = −1.0 (estimated: −1.10) |
| Regime switch sharpness | κ = 1.25 |
| LGD assumption | 45% (configurable) |
| Discount rate | 5% annual (quarterly DF = (1+r)^(−h/4)) |
| ECL horizon | 4 quarters (12-month, IFRS 9 Stage 1) or 20 quarters (lifetime) |
| IFRS 9 Stages | Stage 1: 12-month ECL; Stages 2–3: lifetime ECL |
| Scenarios | Baseline (γ=−0.73), Moderate drought (γ=−1.20), Severe drought (γ=−1.80), Wet/Recovery (γ=+0.80) |
| Migration matrices | Stored in DB; estimated from the research dataset |

---

## Tech Stack (unchanged)

**Next.js 16, TypeScript, Prisma + SQLite, Tailwind CSS, Leaflet maps, pnpm**

---

## Step-by-Step Implementation Plan

---

### PHASE 1 — Database Schema Redesign

**File**: `application/prisma/schema.prisma`

**New/modified models:**

#### User (keep + extend)
- Add `role` String → `"ADMIN"` or `"BORROWER"`
- Add `phone` String?
- Add `nationalId` String?
- Add `district` String? — borrower's district (Mashonaland Central, Manicaland, etc.)
- Add `primaryActivity` String? — Smallholder Agriculture, Informal Trade, Livestock, etc.

#### Loan (new model — replaces Field as primary entity)
- `id` String (CUID)
- `borrowerId` String → FK to User
- `loanRef` String — unique loan reference (e.g. MF04568_L001)
- `currentRating` Int — 1–5 (current credit rating)
- `loanAmount` Float — outstanding principal (EAD)
- `disbursementDate` DateTime
- `stage` String → `"STAGE_1"`, `"STAGE_2"`, `"STAGE_3"` (IFRS 9 stages)
- `status` String → `"ACTIVE"`, `"DEFAULT"`, `"REPAID"`
- `createdAt` DateTime

#### Field (keep — linked to Loan, for spatial/agri analysis)
- Keep polygon, area, location, cropType
- Change `userId` → `loanId` (field belongs to a loan/borrower, drawn by admin)
- Add `district` String? (auto-filled from reverse geocoding)

#### RatingObservation (new model — the core time-series data)
- `id` String
- `loanId` String → FK to Loan
- `obsPeriod` String — e.g. "2024Q4"
- `obsDate` DateTime
- `rating` Int — 1–5
- `defaultFlag` Boolean
- `gamma` Float — drought index for that period/district
- `loanAmount` Float — balance at observation time

#### Analysis (keep + extend)
- Keep all existing fields (NDVI, weather, health status, etc.)
- Link to `fieldId`
- Add `gamma` Float — the γ derived from weather/NDVI data
- Add `regimeWeight` Float — ω(γ) computed value
- Add `agriculturalScore` Float — 0–100 field health score

#### ECLForecast (new model)
- `id` String
- `loanId` String → FK to Loan
- `computedAt` DateTime
- `currentGamma` Float
- `regimeWeight` Float — ω(γ)
- `onePeriodPD` Float — PD for current rating at current γ
- `ecl1Year` Float — 4-quarter ECL
- `ecl5Year` Float — 20-quarter ECL
- `eclBaseline` Float
- `eclModerateDrought` Float
- `eclSevereDrought` Float
- `eclWetRecovery` Float
- `eclExpected` Float — probability-weighted
- `lgd` Float — LGD used (default 0.45)
- `discountRate` Float — annual rate used (default 0.05)

#### MigrationMatrix (new model — stores M_normal and M_stress)
- `id` String
- `matrixType` String — `"NORMAL"` or `"STRESS"`
- `kappa` Float — switching sharpness
- `gamma0` Float — threshold
- `matrixData` String — JSON: 5×5 matrix as 2D array
- `source` String — `"ESTIMATED"` or `"DEFAULT"`
- `createdAt` DateTime

**After schema changes:**
```
pnpm prisma migrate dev --name ecl-schema-redesign
pnpm prisma generate
```

---

### PHASE 2 — Admin Seeding + Migration Matrix Seeding

**Files to create:**
- `application/prisma/seed.ts`

**Seed tasks:**
1. Create single admin user (role: "ADMIN") from env vars `ADMIN_EMAIL` / `ADMIN_PASSWORD`
2. Seed the estimated migration matrices from Chapter 4:

**M_normal (from doc Table 4.4):**
```
State 1: [1.000, 0.000, 0.000, 0.000, 0.000]
State 2: [0.167, 0.500, 0.333, 0.000, 0.000]
State 3: [0.000, 0.100, 0.700, 0.200, 0.000]
State 4: [0.000, 0.000, 0.200, 0.800, 0.000]
State 5: [0.000, 0.000, 0.100, 0.200, 0.700]
```

**M_stress (from doc Table 4.5):**
```
State 1: [1.000, 0.000, 0.000, 0.000, 0.000]
State 2: [0.125, 0.813, 0.063, 0.000, 0.000]
State 3: [0.000, 0.750, 0.250, 0.000, 0.000]
State 4: [0.167, 0.167, 0.333, 0.333, 0.000]  ← Dirichlet prior
State 5: [0.100, 0.100, 0.200, 0.300, 0.300]  ← Dirichlet prior
```
With κ = 1.25, γ₀ = −1.10.

Run: `pnpm prisma db seed`

---

### PHASE 3 — Auth & Middleware

**Goal:** No public signup; admin creates borrower accounts.

1. **`app/auth/signup/page.tsx`** — Replace with "Contact your credit officer to register."
2. **`app/api/auth/signup/route.ts`** — Require admin session to create any account
3. **Create `lib/auth.ts`**:
   - `getSession(request)` → `{ userId, role }` or null
   - `requireAdmin(request)` → session or 401/403
   - `requireAuth(request)` → session or 401
4. After login, redirect:
   - `ADMIN` → `/admin/dashboard`
   - `BORROWER` → `/borrower/dashboard`

---

### PHASE 4 — Admin Dashboard & Borrower Management

**Goal:** Admin manages borrowers (MFI clients) and their loans.

#### New pages:

**`app/admin/dashboard/page.tsx`**
- Fetches all active loans + borrowers
- Summary cards: Total Portfolio EAD, Portfolio ECL (1-Year), # Active Borrowers, # In Default
- Table: Borrower | District | Rating | γ | ω(γ) | 1Q PD | 1-Year ECL | IFRS 9 Stage
- Filter by regime (Normal / Stress / All)

**`app/admin/borrowers/new/page.tsx`**
- Form fields:
  - Full Name, Email (login), Phone, National ID
  - District (dropdown: Mashonaland Central, Mashonaland East, Manicaland, Masvingo, Matabeleland South, Midlands)
  - Primary Activity (dropdown: Smallholder Agriculture, Informal Trade, Livestock & Agri-processing, Services & Transport, Other)
  - Temporary password
- Creates User with `role: "BORROWER"`

**`app/admin/borrowers/[borrowerId]/page.tsx`**
- Borrower profile details
- Loan history table (obs_period, rating, gamma, defaultFlag, loanAmount)
- Latest ECL forecast
- Field/farm on map (if registered)
- Buttons: "Add Loan Observation" | "Update Rating" | "Run ECL" | "Generate Report" | "Add Field"

**`app/admin/loans/new/page.tsx`**
- Create new loan for a borrower:
  - Select borrower, enter loanRef, initial rating, loanAmount, disbursementDate, IFRS 9 stage

#### New API routes:

- `app/api/admin/borrowers/route.ts` (GET all, POST create)
- `app/api/admin/borrowers/[borrowerId]/route.ts` (GET, PATCH, DELETE)
- `app/api/admin/loans/route.ts` (POST create loan)
- `app/api/admin/loans/[loanId]/observations/route.ts` (POST add rating observation)

---

### PHASE 5 — Field Management (Admin Creates for Borrower)

**Goal:** Admin draws a polygon for a borrower's farm to enable satellite NDVI analysis.

1. **`app/admin/fields/create/page.tsx`** — Map with:
   - "Select Borrower" dropdown
   - Crop type field
   - Leaflet polygon drawing
   - Save → POST `/api/admin/fields`

2. **`app/api/admin/fields/route.ts`** (POST)
   - Creates Field linked to borrower (via `borrowerId`)
   - Auto-calculates area, reverse-geocodes location

3. **`app/api/admin/fields/[fieldId]/analyse/route.ts`** (POST)
   - Fetches NDVI (region-based) + Open-Meteo weather (14-day)
   - Computes agricultural score (Phase 6)
   - Derives γ proxy from weather data (Phase 6)
   - Saves Analysis record

---

### PHASE 6 — Agricultural Score + γ Derivation from Satellite Data

**File to create:** `application/lib/analysis/scoring.ts`

**Agricultural Score (0–100) — field health:**

| Component | Weight | Formula |
|-----------|--------|---------|
| NDVI | 40 pts | `meanNDVI / 0.9 * 40` (cap at 40) |
| Rainfall | 25 pts | `min(totalRainfall / 50, 1) * 25` |
| Temperature | 20 pts | Optimal 18–28°C = 20pts; −1pt per °C outside range |
| NDVI Trend | 10 pts | IMPROVING=10, STABLE=6, DECLINING=0 |
| Risk penalties | −5 each | waterStressRisk, diseaseRisk |

Score = `max(0, min(100, sum))`

**γ (Drought Index Proxy) Derivation from Weather Data:**

Since real SPEI requires historical evapotranspiration data (not always available), we derive a proxy γ from the available weather signals:

```
rainfall_anomaly = (totalRainfall_14day - 25) / 15    // 25mm = normal 14-day, 15mm = stddev
temp_anomaly = (avgTemp - 23) / 4                      // 23°C = normal, 4°C = stddev
ndvi_signal = (meanNDVI - 0.55) / 0.15                 // 0.55 = normal, 0.15 = stddev

gamma_proxy = 0.6 * rainfall_anomaly - 0.3 * temp_anomaly + 0.1 * ndvi_signal
gamma_proxy = max(-3.0, min(3.0, gamma_proxy))          // clamp to SPEI range
```

This γ proxy is stored in `Analysis.gamma` and used in ECL calculations.

**Score Bands:**
- 75–100: Excellent (likely γ > 0)
- 50–74: Good (likely γ ≈ −0.5 to 0)
- 25–49: Moderate Stress (likely γ ≈ −1.0 to −0.5)
- 0–24: High Stress (likely γ < −1.0)

---

### PHASE 7 — ECL Calculation Engine

**File to create:** `application/lib/ecl/engine.ts`

**Core functions:**

#### `computeRegimeWeight(gamma, kappa = 1.25, gamma0 = -1.10): number`
```
ω(γ) = 1 / (1 + exp(-κ(γ - γ₀)))
```

#### `blendMatrices(mNormal, mStress, omega): number[][]`
```
P(γ) = ω · M_stress + (1 - ω) · M_normal
```

#### `matrixPower(P, h): number[][]`
```
Compute P^h via repeated matrix multiplication for horizon h quarters
```

#### `computePD(rating, gamma, matrices): { onePeriodPD, cumulativePD4Q, cumulativePD20Q }`
```
onePeriodPD = P(γ)[rating-1][0]   // transition to State 1 (index 0)
cumulativePD_h = (P^h)[rating-1][0]
```

#### `computeECL(loan, gamma, matrices): ECLResult`
```
For each quarter h = 1..H:
  marginalPD_h = cumulPD_h - cumulPD_(h-1)
  DF_h = (1 + r)^(-h/4)
  ECL += DF_h * EAD * LGD * marginalPD_h

Return: { onePeriodPD, ecl1Year, ecl5Year, regimeWeight, eclByScenario }
```

#### `computeScenarioECL(loan, matrices): ScenarioECL`
Run ECL for four scenarios:
- Baseline: γ = −0.73 (historical average), probability 55%
- Moderate Drought: γ = −1.20, probability 25%
- Severe Drought: γ = −1.80, probability 12%
- Wet/Recovery: γ = +0.80, probability 8%

Expected ECL = sum(scenario.ecl * scenario.probability)

**IFRS 9 Stage Assignment:**
- Stage 1: current rating ≥ 3 AND γ ≥ −1.0 → 12-month ECL
- Stage 2: rating ≥ 3 AND γ < −1.0, OR rating = 2 AND γ ≥ −1.0 → lifetime ECL
- Stage 3: rating = 1 (default), OR rating = 2 AND γ < −1.0 → lifetime ECL

**API route:** `app/api/admin/ecl/[loanId]/route.ts` (POST)
- Load M_normal and M_stress from DB
- Fetch latest gamma from Analysis OR use provided gamma
- Run `computeECL` + `computeScenarioECL`
- Save to `ECLForecast` table
- Return full ECL breakdown

---

### PHASE 8 — Report Generation

**File to create:** `application/lib/reports/generateBorrowerReport.ts`

**Report structure (JSON stored in DB, rendered as HTML page):**

```json
{
  "generatedAt": "ISO date",
  "borrower": {
    "name": "...", "nationalId": "...", "district": "...",
    "primaryActivity": "...", "phone": "..."
  },
  "loan": {
    "loanRef": "...", "currentRating": 3, "loanAmount": 980,
    "ifrs9Stage": "STAGE_2", "status": "ACTIVE"
  },
  "climateDroughtSignal": {
    "gamma": -1.32,
    "regimeWeight": 0.57,
    "regimeLabel": "Moderate Stress",
    "interpretation": "Portfolio is in the drought-stress regime..."
  },
  "agricultural": {
    "score": 52, "scoreBand": "Good",
    "meanNDVI": 0.55, "ndviTrend": "STABLE",
    "avgTemperature": 26.1, "totalRainfall": 31.4,
    "waterStressRisk": false, "diseaseRisk": false
  },
  "creditRisk": {
    "onePeriodPD": 0.143,
    "ecl1Year": 145.32,
    "ecl5Year": 387.00,
    "lgd": 0.45, "discountRate": 0.05
  },
  "scenarioAnalysis": {
    "baseline":         { "gamma": -0.73, "ecl1Year": 95,  "ecl5Year": 285, "prob": 0.55 },
    "moderateDrought":  { "gamma": -1.20, "ecl1Year": 145, "ecl5Year": 432, "prob": 0.25 },
    "severeDrought":    { "gamma": -1.80, "ecl1Year": 230, "ecl5Year": 695, "prob": 0.12 },
    "wetRecovery":      { "gamma":  0.80, "ecl1Year": 48,  "ecl5Year": 145, "prob": 0.08 },
    "expected":         { "ecl1Year": 128, "ecl5Year": 385 }
  },
  "recommendations": ["..."],
  "disclaimer": "ECL estimates are based on the Two-Regime Markov-Switching Model conditioned on satellite-derived drought proxy (γ). Agricultural score reflects field-level NDVI and weather data. These are risk indicators only and do not constitute investment or lending advice."
}
```

**Report page:** `app/admin/borrowers/[borrowerId]/report/page.tsx`
- Clean, print-friendly layout
- Sections:
  1. Borrower & Loan Summary
  2. Climate / Drought Signal (γ, ω(γ), regime label)
  3. Agricultural Health (score, NDVI, weather, risks)
  4. Credit Risk Metrics (PD, 1-year ECL, lifetime ECL)
  5. IFRS 9 Scenario Analysis (table + bar chart)
  6. Recommendations
- "Print / Export PDF" button

**API:** `app/api/admin/borrowers/[borrowerId]/report/route.ts` (GET)

---

### PHASE 9 — Portfolio Dashboard

**Goal:** Admin sees total MFI exposure and aggregate ECL across all scenarios.

**`app/admin/portfolio/page.tsx`**
- Summary cards:
  - Total Active Loans: N
  - Total EAD: $X
  - Portfolio 1-Year ECL (Baseline): $X
  - Portfolio 1-Year ECL (Severe Drought): $X
  - Provisioning Rate: X%
- Rating distribution bar chart (Rating 1–5 counts)
- Regime classification: % borrowers in Normal vs Stress regime
- ECL scenario comparison bar chart (baseline/moderate/severe/wet)
- Table: all loans with rating, γ, ω(γ), 1Q PD, ECL

**API:** `app/api/admin/portfolio/route.ts` (GET)
- Aggregate all active loan ECLs
- Sum by scenario
- Return distribution data

---

### PHASE 10 — Borrower Read-Only View

**Goal:** Borrowers can log in and see their own data (no edit access).

1. **`app/borrower/dashboard/page.tsx`**
   - Their loan status, current rating
   - Agricultural score (if field registered)
   - Current climate signal (γ label — shown as "Good conditions" / "Drought stress" not the raw number)
   - Latest ECL estimate (shown as "Your estimated exposure")

2. **`app/borrower/report/page.tsx`**
   - Simplified version of full report (no raw PD numbers — farmer-friendly language)

---

### PHASE 11 — ML Model + Scoring Rename

1. Rename `application/models/` references from "tobacco" to "agricultural"
2. Rename `crop_health_model.json` → `agricultural_health_model.json`
3. Update `lib/ml/inference.ts` path reference
4. Remove `cropType: "Tobacco"` default — admin sets crop type per field

---

### PHASE 12 — UI Cleanup & Branding

1. Rename app from "TobaccoGuard" → **"AgriFin Risk Monitor"** or similar
2. Update all tobacco branding in `app/page.tsx`, layouts, navbar
3. Role-based navigation:
   - Admin: Dashboard | Borrowers | Portfolio | Settings
   - Borrower: My Loan | My Farm | My Report
4. Update `next.config.ts` page title

---

## Build Order

```
Phase 1  → DB schema + migrate
Phase 2  → Admin + matrix seeding
Phase 3  → Auth overhaul
Phase 4  → Admin dashboard + borrower CRUD
Phase 5  → Field creation (linked to borrower)
Phase 6  → Agricultural score + γ derivation
Phase 7  → ECL engine (core math)
Phase 8  → Report generation
Phase 9  → Portfolio dashboard
Phase 10 → Borrower read-only view
Phase 11 → ML model rename
Phase 12 → UI cleanup
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | DB models (Phase 1) |
| `prisma/seed.ts` | Admin + matrix seeding (Phase 2) |
| `lib/auth.ts` | Session helpers (Phase 3) |
| `lib/ecl/engine.ts` | Core ECL math: ω(γ), PD, ECL, scenarios (Phase 7) |
| `lib/analysis/scoring.ts` | Agricultural score + γ proxy (Phase 6) |
| `lib/reports/generateBorrowerReport.ts` | Report builder (Phase 8) |
| `lib/gee/satellite.ts` | NDVI + weather fetch — keep, no changes |
| `lib/ml/inference.ts` | LR crop health classifier — minor rename |
| `app/api/admin/` | All admin API routes |
| `app/api/admin/ecl/` | ECL calculation endpoints (Phase 7) |
| `app/admin/` | Admin UI pages |
| `app/borrower/` | Borrower read-only pages |

---

## Key Research Parameters (Hard-code as defaults, make configurable)

| Parameter | Value | Source |
|-----------|-------|--------|
| κ (kappa) | 1.25 | Doc §4.4, bootstrap CI [0.92, 1.58] |
| γ₀ (gamma0) | −1.10 | Doc §4.4, bootstrap CI [−1.38, −0.82] |
| LGD | 45% | Doc §3.8 |
| Discount rate | 5% annual | Doc §3.8 |
| Drought threshold | γ < −1.0 | WMO standard, Doc §3.2 |
| Baseline γ | −0.73 | Doc §4.7 (historical mean of dataset) |
| Scenario probabilities | 55/25/12/8% | Doc §4.7 Table |

---

## Notes & Assumptions

- **M_normal and M_stress** are seeded from the research estimates. In future, the admin could re-estimate them from updated data.
- **γ is a proxy**, not true SPEI. True SPEI requires historical precipitation + temperature series. The proxy uses satellite/weather data available from Open-Meteo.
- **Rating 5 (State 5)** rows use Dirichlet priors as in the research (no observed transitions from Rating 5 in the sample).
- **Agricultural score ≠ ECL score**. They are complementary: agricultural score reflects field health; ECL reflects financial loss exposure given the credit rating and climate conditions.
- **IFRS 9 stage assignment** in the app is a simplified approximation — real stage classification requires origination rating comparison, not just current conditions.
- **Single admin**: Only one admin account. Seeded via `prisma/seed.ts`.
- **SQLite stays** for this project scope.
