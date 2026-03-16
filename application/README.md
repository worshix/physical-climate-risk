# AgriFin Risk Monitor

A full-stack web application prototype demonstrating a **Two-Regime Markov-Switching IFRS 9 Expected Credit Loss (ECL)** model conditioned on physical climate risk for Zimbabwean microfinance institutions.

---

## What It Does

Microfinance lenders in Zimbabwe face elevated credit risk during droughts. Standard IFRS 9 ECL models use a single set of credit migration probabilities regardless of climate conditions. This platform implements a two-regime model that switches between normal and drought-stress migration matrices based on a real SPEI-3 drought index derived from satellite weather data.

**For the credit officer (Admin):**
- Register borrowers and manage their loan portfolios
- View each farmer's SPEI-3 drought index, agricultural health score, and satellite data — populated automatically when the farmer sets up their field
- Add quarterly rating observations with SPEI values
- Generate IFRS 9 ECL forecasts and print-ready borrower reports
- Monitor portfolio-wide ECL, regime breakdown, and rating distribution

**For the farmer (Borrower):**
- Self-register and draw their field boundary on a satellite map
- Receive a real SPEI-3 drought index computed from 3 years of Open-Meteo historical data
- See their farm health score, rainfall, temperature, NDVI, and plain-language recommendations
- View their loan status and a farmer-friendly report (no raw model parameters)

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Maps | Leaflet.js + React-Leaflet + Leaflet-Draw |
| Database | SQLite via Prisma ORM (Prisma 7, better-sqlite3 adapter) |
| Authentication | HTTP-only cookie sessions + bcryptjs |
| Weather & SPEI | Open-Meteo forecast + archive API (free, no API key) |
| Geocoding | OpenStreetMap Nominatim (free, no API key) |
| ML Model | Logistic Regression (TypeScript inference, JSON weights) |
| Package Manager | pnpm |

---

## Data Sources

| Signal | Source | Real or Estimated |
| --- | --- | --- |
| Temperature (14-day) | Open-Meteo forecast API | **Real** |
| Rainfall (14-day) | Open-Meteo forecast API | **Real** |
| SPEI-3 drought index (γ) | Open-Meteo archive API → Thornthwaite PET → empirical CDF | **Real** |
| NDVI vegetation index | Region-type heuristic (arid / tropical / temperate) | Estimated |

NDVI would be replaced by Sentinel Hub or Google Earth Engine in production. The architecture isolates this behind `lib/gee/satellite.ts` so the swap is straightforward.

The SPEI-3 implementation follows Vicente-Serrano et al. (2010) and uses WMO (2012) classification thresholds — the same methodology cited in the accompanying dissertation.

---

## Model Parameters

| Parameter | Value | Meaning |
| --- | --- | --- |
| κ (kappa) | 1.25 | Logistic sharpness of regime switch |
| γ₀ (gamma0) | −1.10 | SPEI threshold — drought tipping point |
| LGD | 45% | Loss Given Default |
| Discount rate | 5% p.a. | Quarterly discounting for ECL |

Regime weight: `ω(γ) = 1 / (1 + exp(κ · (γ − γ₀)))`

Blended matrix: `P(γ) = ω · M_stress + (1 − ω) · M_normal`

---

## Database Schema

```
User           — id, name, email, password, role (ADMIN|BORROWER),
                 phone, nationalId, district, primaryActivity
Field          — id, name, cropType, polygon (GeoJSON), area, location,
                 district, borrowerId
Analysis       — id, fieldId, meanNDVI, ndviTrend, healthStatus,
                 avgTemperature, totalRainfall, waterStressRisk, diseaseRisk,
                 gamma (SPEI-3), regimeWeight (ω), agriculturalScore,
                 rawData, recommendations
Loan           — id, borrowerId, loanRef, currentRating, loanAmount,
                 disbursementDate, stage, status
RatingObservation — id, loanId, obsPeriod, obsDate, rating, defaultFlag,
                    gamma, loanAmount
ECLForecast    — id, loanId, currentGamma, regimeWeight, onePeriodPD,
                 ecl1Year, ecl5Year, eclBaseline, eclModerateDrought,
                 eclSevereDrought, eclWetRecovery, eclExpected
MigrationMatrix — id, matrixType (NORMAL|STRESS), kappa, gamma0, matrixData
```

---

## Running the App

### Prerequisites

- Node.js 20+
- pnpm

### Install

```bash
cd application
pnpm install
```

### Configure environment

Edit `.env` (already created):

```env
DATABASE_URL="file:../dev.db"
ADMIN_EMAIL="admin@agrifin.local"
ADMIN_PASSWORD="changeme123"
```

Change `ADMIN_EMAIL` and `ADMIN_PASSWORD` before seeding.

### Set up the database

```bash
pnpm prisma migrate dev
pnpm tsx prisma/seed.ts
```

The seed creates exactly one admin account and loads the M_normal + M_stress migration matrices from Chapter 4 of the dissertation.

### Start dev server

```bash
pnpm dev
```

Visit `http://localhost:3000`.

---

## User Flows

### Admin

```
/auth/login → /admin/dashboard
  → /admin/borrowers/new            Register a farmer
  → /admin/borrowers/[id]           View profile, credit risk, agricultural signal
      → /admin/fields/[fid]/analyse View farmer's field analysis (read-only)
      → /admin/loans/new            Add loan
      → /admin/loans/[lid]          Loan detail + ECL
          → add-observation         Add quarterly SPEI + rating observation
      → /admin/borrowers/[id]/report  IFRS 9 report (printable)
  → /admin/portfolio                Portfolio-wide ECL + regime breakdown
```

### Farmer

```
/auth/signup → /borrower/onboarding  (draw field polygon → SPEI analysis auto-runs)
  → /borrower/dashboard              Loan, SPEI index, farm health
      → /borrower/field              Full field details + re-analyse
      → /borrower/report             Print-friendly farmer report
```

---

## Project Structure (abbreviated)

```
application/
├── app/
│   ├── page.tsx               Landing page
│   ├── auth/                  Login + farmer self-registration
│   ├── admin/                 All credit officer pages
│   └── borrower/              All farmer pages
├── lib/
│   ├── auth.ts                Session helpers (getAdminSession, getBorrowerSession)
│   ├── ecl/engine.ts          Two-Regime ECL computation
│   ├── gee/satellite.ts       Weather + SPEI orchestration
│   ├── gee/spei.ts            Full SPEI-3 (Thornthwaite + Open-Meteo archive)
│   ├── analysis/scoring.ts    Agricultural score + γ derivation
│   └── reports/               Admin report data assembly
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                Admin + M_normal + M_stress matrices
├── models/
│   └── agricultural_health_model.json
├── .env
├── dev.db
└── APP_STRUCTURE.md           Full route map and architecture notes
```

See [APP_STRUCTURE.md](./APP_STRUCTURE.md) for the complete route map, data flow diagram, and file tree.
