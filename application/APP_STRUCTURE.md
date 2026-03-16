# AgriFin Risk Monitor — Application Structure

## Overview

AgriFin Risk Monitor is a two-role web application that serves as the
operational prototype for a Two-Regime Markov-Switching IFRS 9 ECL model
conditioned on physical climate risk (SPEI-3 drought index).

**Two roles:**

| Role | Who | Entry point after login |
|---|---|---|
| **Admin** | Credit officer / MFI staff | `/admin/dashboard` |
| **Borrower** | Registered farmer | `/borrower/dashboard` |

---

## Route Map

### Public

| Route | Purpose |
|---|---|
| `/` | Landing page — AgriFin branding, model parameters, two CTAs |
| `/auth/login` | Login form — redirects by role after success |
| `/auth/signup` | Farmer self-registration (name, email, password, phone, national ID, district, primary activity) → `/borrower/onboarding` |

---

### Admin Routes

All admin routes require an active ADMIN session (HTTP-only `userId` + `userRole` cookies). Unauthorised requests redirect to `/auth/login`.

| Route | Purpose |
|---|---|
| `/admin/dashboard` | Portfolio overview — summary cards (borrowers, EAD, 1-yr ECL, defaults), active loan book table with ratings, regime, PD, ECL per row |
| `/admin/portfolio` | Detailed portfolio risk — ECL scenario bars, regime breakdown, rating distribution, full loan table |
| `/admin/borrowers/new` | Register a new borrower (name, email, password, phone, national ID, district, activity) |
| `/admin/borrowers/[borrowerId]` | Borrower detail — profile, credit risk summary (rating, stage, EAD, ω, PD, ECL), agricultural signal (SPEI-3, agri score, NDVI, rainfall, temperature), loan history, rating observation timeline |
| `/admin/borrowers/[borrowerId]/report` | Print-friendly 6-section IFRS 9 report — borrower & loan, climate/drought, agricultural health, credit risk metrics, IFRS 9 scenario analysis, recommendations |
| `/admin/fields/[fieldId]/analyse` | **Read-only** field view — shows farmer's latest SPEI-3, agri score, vegetation signal, ECL forecast, recommendations. Admin cannot trigger or re-run analysis. |
| `/admin/loans/new` | Create a loan for a borrower (loan ref, rating, amount, disbursement date, IFRS 9 stage) |
| `/admin/loans/[loanId]` | Loan detail — loan summary, ECL summary, rating observations table |
| `/admin/loans/[loanId]/add-observation` | Add a quarterly rating observation (period, date, rating, default flag, γ SPEI, outstanding balance) |

> **Admin cannot create fields.** Fields are created exclusively by farmers through the self-service onboarding flow.

---

### Borrower Routes

All borrower routes require an active BORROWER session.

| Route | Purpose |
|---|---|
| `/borrower/dashboard` | Farmer home — welcome, loan summary, SPEI drought index card, farm health metrics, recommendations, "Set up farm" CTA if no field |
| `/borrower/onboarding` | First-time field setup — draw polygon on satellite map → analysis runs automatically → shows SPEI + agri score on success |
| `/borrower/field` | Field management — SPEI-3 card, agri score card, field map, recommendations, Re-analyse button |
| `/borrower/report` | Farmer-friendly report — My Details, My Loan, Climate & Weather (SPEI), Farm Health, Credit Exposure Estimate, Recommendations. Print/PDF button. No raw model parameters exposed. |

---

## Navigation Summary

```
/ (landing)
├── /auth/login
│   ├── → /admin/dashboard      (ADMIN role)
│   └── → /borrower/dashboard   (BORROWER role)
└── /auth/signup
    └── → /borrower/onboarding

/admin/dashboard
├── /admin/portfolio
├── /admin/borrowers/new
└── /admin/borrowers/[borrowerId]
    ├── /admin/borrowers/[borrowerId]/report
    ├── /admin/loans/new
    ├── /admin/loans/[loanId]
    │   └── /admin/loans/[loanId]/add-observation
    └── /admin/fields/[fieldId]/analyse   (read-only)

/borrower/dashboard
├── /borrower/onboarding   (if no field)
├── /borrower/field        (if field exists)
└── /borrower/report
```

---

## Data Flow

```
Farmer draws field polygon on map
        ↓
POST /api/borrower/field
  → Area calculated (Shoelace), location geocoded (Nominatim)
  → Field saved to DB
        ↓
POST /api/borrower/field/[fieldId]/analyse
  → getSatelliteData(polygon)
      ├── Open-Meteo forecast API → 14-day temperature + rainfall (REAL)
      ├── Open-Meteo archive API → 36-month history → SPEI-3 via
      │   Thornthwaite PET + empirical CDF (REAL, Vicente-Serrano 2010)
      └── NDVI → region-type heuristic (arid / tropical / temperate)
  → computeGamma() → SPEI-3 value = γ
  → computeAgriScore() → 0–100 score
  → getRecommendations() → plain-language rule-based advice
  → Analysis record saved to DB (γ, ω, agri score, NDVI, weather, recs)
        ↓
Admin views /admin/borrowers/[borrowerId]
  → Sees SPEI-3 γ, agri score, NDVI inline
  → "View Full Field Details" → /admin/fields/[fieldId]/analyse (read-only)
        ↓
Admin adds loan + rating observations
  → POST /api/admin/loans
  → POST /api/admin/loans/[loanId]/observations
        ↓
ECL engine runs (lib/ecl/engine.ts)
  → ω(γ) = 1 / (1 + e^{κ(γ − γ₀)})    κ=1.25, γ₀=−1.10
  → P(γ) = ω·M_stress + (1−ω)·M_normal
  → 1-yr and 5-yr ECL, 4-scenario IFRS 9 analysis
  → ECLForecast saved to DB
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Admin cannot create fields | Fields represent the farmer's physical asset. Ownership and accuracy require the farmer to draw their own boundary. Admin reads what the farmer has set up. |
| SPEI-3 via Open-Meteo archive | Free, no API key, production-grade data. Follows Vicente-Serrano et al. (2010) methodology — the same method cited in the dissertation. |
| NDVI is estimated, not real | Real NDVI requires Sentinel Hub or GEE (paid/gated). Heuristic is clearly labelled; the architecture is designed for a real data source to be swapped in. |
| Two-stage ECL | 1-year ECL for IFRS 9 Stage 1; 5-year lifetime ECL for Stages 2 & 3. Four climate scenarios probability-weighted per IFRS 9 forward-looking requirements. |
| Borrower report hides model params | Farmers see plain-language outputs only. Technical parameters (κ, γ₀, ω, PD) are visible only on admin-facing pages. |

---

## File Structure

```
application/
├── app/
│   ├── page.tsx                          Landing page
│   ├── layout.tsx                        Root layout + metadata
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── admin/
│   │   ├── dashboard/page.tsx
│   │   ├── portfolio/page.tsx
│   │   ├── borrowers/
│   │   │   ├── new/page.tsx
│   │   │   └── [borrowerId]/
│   │   │       ├── page.tsx
│   │   │       └── report/page.tsx
│   │   ├── fields/
│   │   │   └── [fieldId]/analyse/page.tsx  (read-only)
│   │   └── loans/
│   │       ├── new/page.tsx
│   │       └── [loanId]/
│   │           ├── page.tsx
│   │           └── add-observation/page.tsx
│   ├── borrower/
│   │   ├── dashboard/page.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── field/page.tsx
│   │   └── report/page.tsx
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── signup/route.ts
│       ├── admin/
│       │   ├── borrowers/route.ts
│       │   ├── borrowers/[borrowerId]/route.ts
│       │   ├── borrowers/[borrowerId]/report/route.ts
│       │   ├── fields/[fieldId]/route.ts     (GET only — read)
│       │   ├── loans/route.ts
│       │   ├── loans/[loanId]/observations/route.ts
│       │   └── portfolio/route.ts
│       └── borrower/
│           ├── field/route.ts
│           └── field/[fieldId]/analyse/route.ts
├── components/
│   ├── LogoutButton.tsx
│   ├── PrintButton.tsx
│   └── ui/                               shadcn/ui primitives
├── lib/
│   ├── auth.ts                           getAdminSession, getBorrowerSession
│   ├── prisma.ts                         Prisma client singleton (better-sqlite3)
│   ├── analysis/
│   │   ├── recommendations.ts            Rule-based recommendation engine
│   │   └── scoring.ts                    Agricultural score + γ via SPEI-3
│   ├── ecl/
│   │   └── engine.ts                     Two-Regime ECL computation
│   ├── gee/
│   │   ├── satellite.ts                  NDVI + weather + SPEI orchestration
│   │   └── spei.ts                       Full SPEI-3 implementation
│   ├── geo/
│   │   └── utils.ts                      Centroid, area, reverse geocoding
│   ├── ml/
│   │   └── inference.ts                  Logistic Regression (agricultural health)
│   └── reports/
│       └── generateBorrowerReport.ts     Admin report data assembly
├── models/
│   └── agricultural_health_model.json   Exported LR coefficients
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                           Admin + migration matrices
│   └── migrations/
├── prisma.config.ts
├── .env                                  DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
├── dev.db
└── next.config.ts
```

---

## Database Schema (summary)

| Model | Key fields |
|---|---|
| `User` | id, name, email, password, role (ADMIN\|BORROWER), phone, nationalId, district, primaryActivity |
| `Field` | id, name, cropType, polygon (GeoJSON), area, location, district, borrowerId |
| `Analysis` | id, fieldId, meanNDVI, ndviTrend, healthStatus, avgTemperature, totalRainfall, waterStressRisk, diseaseRisk, **gamma** (SPEI-3), **regimeWeight** (ω), **agriculturalScore**, rawData, recommendations |
| `Loan` | id, borrowerId, loanRef, currentRating, loanAmount, disbursementDate, stage, status |
| `RatingObservation` | id, loanId, obsPeriod, obsDate, rating, defaultFlag, **gamma**, loanAmount |
| `ECLForecast` | id, loanId, currentGamma, regimeWeight, onePeriodPD, ecl1Year, ecl5Year, eclBaseline, eclModerateDrought, eclSevereDrought, eclWetRecovery, eclExpected |
| `MigrationMatrix` | id, matrixType (NORMAL\|STRESS), kappa, gamma0, matrixData (JSON) |
