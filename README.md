# Physical Climate Risk in IFRS 9 ECL Frameworks

**Harare Institute of Technology — Department of Applied Mathematics — March 2026**

Modelling physical climate risk in microfinance credit portfolios using a
Two-Regime Markov-Switching model conditioned on the SPEI-3 drought index,
with IFRS 9 Expected Credit Loss application.

---

## Repository Structure

```
physical-climate-risk/
├── application/          Next.js web prototype (AgriFin Risk Monitor)
├── document/             Full research dissertation (LaTeX)
├── explanation/          Plain-language guide to the ECL pipeline and tests
├── tests/                Python pipeline (5-stage ECL computation + 82 unit tests)
├── jay_dataset.csv       MFI panel dataset (6 borrowers, 59 observations)
└── README.md             This file
```

---

## Components

### `application/` — Web Prototype

A full-stack Next.js 16 application demonstrating the model in realistic
operational use. Two user roles:

- **Admin (credit officer)** — registers borrowers, manages loans and
  quarterly SPEI observations, views ECL forecasts and IFRS 9 reports,
  monitors portfolio-wide risk
- **Borrower (farmer)** — self-registers, draws field boundary on satellite
  map, receives real SPEI-3 drought index and agricultural health score,
  views loan status and farmer-friendly report

See `application/README.md` and `application/APP_STRUCTURE.md` for full
documentation.

### `document/` — Dissertation

The full research dissertation in LaTeX covering the theoretical framework,
dataset description, model estimation, ECL results, and conclusions.

Compile with:

```bash
pdflatex document/document.tex
```

### `explanation/` — Process Guide

A plain-language LaTeX document explaining each stage of the Python pipeline,
what each screen in the prototype shows, and how to run the unit tests.

Compile with:

```bash
pdflatex explanation/explanation.tex
```

### `tests/` — Python Pipeline

The five-stage ECL computation pipeline implemented in Python:

| Stage | Module | Purpose |
| --- | --- | --- |
| 1 | `ingestion.py` | Load and validate the MFI panel dataset |
| 2 | `transitions.py` | Extract quarterly rating transitions, label regimes |
| 3 | `estimation.py` | Estimate M\_normal, M\_stress, κ, γ₀ via MLE |
| 4 | `forecasting.py` | Compute 1-yr / 5-yr ECL with four IFRS 9 scenarios |
| 5 | `validation.py` | Backtest AUC, Brier Score vs single-regime baseline |

Run all 82 tests:

```bash
cd tests
uv run pytest tests/ -v
```

---

## Model Summary

The regime weight blends two migration matrices based on the SPEI-3 drought index:

```
ω(γ) = 1 / (1 + exp(κ · (γ − γ₀)))     κ = 1.25,  γ₀ = −1.10

P(γ) = ω(γ) · M_stress + (1 − ω(γ)) · M_normal

ECL  = Σ_{h=1}^{H} (1+r)^{−h/4} · EAD · LGD · PD_h     LGD = 45%,  r = 5%
```

Four IFRS 9 forward-looking scenarios (baseline 55%, moderate drought 25%,
severe drought 12%, wet recovery 8%) produce the probability-weighted ECL.

---

## Running the Web App

```bash
cd application
pnpm install
pnpm prisma migrate dev
pnpm tsx prisma/seed.ts   # creates admin + seeds migration matrices
pnpm dev
```

Visit `http://localhost:3000`. Default admin credentials are in `application/.env`.
