# ECL Prototype — Two-Regime Markov-Switching Credit Risk Model

**Modelling Physical Climate Risk in IFRS 9 ECL Frameworks**
Harare Institute of Technology (HIT) · Department of Applied Mathematics · 2026

---

## What This Project Does

This prototype estimates Expected Credit Loss (ECL) for a Zimbabwean microfinance
portfolio under IFRS 9, using a two-regime Markov-switching credit migration model
that accounts for drought conditions via the SPEI drought index (γ).

Under drought (γ < −1.0) the model applies a stress transition matrix with higher
default probabilities. Under normal conditions it uses a normal transition matrix.
The switch between regimes is smooth — controlled by a logistic function with
learned parameters κ (sharpness) and γ₀ (threshold).

---

## Project Structure

```
prototype/
├── app.py                  # Streamlit application (entry point)
├── config.py               # All constants and hyperparameters
├── pyproject.toml          # Dependencies managed with uv
│
├── data/
│   └── jay_dataset.csv     # MFI panel dataset (6 borrowers, 59 observations)
│
├── src/
│   ├── ingestion.py        # Stage 1 — load and validate the CSV
│   ├── transitions.py      # Stage 2 — extract rating transitions
│   ├── estimation.py       # Stage 3 — two-regime model estimation (MLE)
│   ├── forecasting.py      # Stage 4 — ECL calculation and scenario analysis
│   ├── validation.py       # Stage 5 — AUC, Brier score, backtesting
│   ├── svdm.py             # SVDM metric and bootstrap confidence intervals
│   └── plots.py            # All charts (Matplotlib, non-interactive)
│
├── tests/
│   ├── test_ingestion.py   # Stage 1 tests
│   ├── test_transitions.py # Stage 2 tests
│   ├── test_estimation.py  # Stage 3 tests
│   ├── test_forecasting.py # Stage 4 tests
│   └── test_validation.py  # Stage 5 tests
│
└── outputs/
    ├── csv/                # Exported model results (CSV)
    └── figures/            # Exported charts (PNG)
```

Related files outside this folder:

```
document/document.tex       # Full LaTeX research dissertation
explanation/explanation.tex # Plain-language guide to the system and tests
```

---

## Requirements

- Python 3.11+
- [`uv`](https://docs.astral.sh/uv/) package manager

Install `uv` if you do not have it:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## Getting Started

### 1. Install dependencies

From inside the `prototype/` folder:

```bash
uv sync
```

This reads `pyproject.toml` and installs all dependencies into a local `.venv`.
You do not need to activate the virtual environment manually — prefix every
command with `uv run`.

### 2. Run the Streamlit application

```bash
uv run streamlit run app.py
```

The app opens in your browser at `http://localhost:8501`.
Use the sidebar to navigate between the five pages.

### 3. Run the process tests

```bash
uv run pytest tests/ -v
```

Expected output:

```
======================== 82 passed, 8 warnings in 1.89s ========================
```

To run a single test file:

```bash
uv run pytest tests/test_estimation.py -v
```

---

## Application Pages

| Page | What it shows |
|------|---------------|
| **1 · Dataset Overview** | Summary statistics, rating distribution bar chart, SPEI time series, raw data table |
| **2 · Transition Analysis** | Count matrices and heatmaps for normal, stress, and pooled regimes |
| **3 · Regime Model Estimation** | Estimated κ and γ₀, regime matrices, logistic weight curve, LRT result, SVDM |
| **4 · ECL Scenario Simulator** | Portfolio ECL table, climate scenario comparison chart, PD fan chart, LGD/horizon sliders |
| **5 · Backtesting Metrics** | AUC and Brier score comparison (two-regime vs. single-regime), ROC curves |

---

## Key Configuration (`config.py`)

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `N_STATES` | 5 | Number of credit rating states (1 = default, 5 = best) |
| `DROUGHT_THRESHOLD` | −1.0 | SPEI value below which a period is labelled stress regime |
| `KAPPA_INIT` | 1.25 | Initial guess for logistic sharpness κ |
| `GAMMA0_INIT` | −1.10 | Initial guess for drought threshold γ₀ |
| `DEFAULT_LGD` | 0.45 | Loss Given Default (45%) |
| `DEFAULT_DISCOUNT_RATE` | 0.05 | Annual discount rate (5%) |
| `DEFAULT_HORIZON` | 20 | Forecast horizon in quarters (5 years) |

Climate scenarios used in ECL calculation:

| Scenario | γ override | Probability |
|----------|-----------|-------------|
| Baseline | −0.73 | 55% |
| Moderate Drought | −1.20 | 25% |
| Severe Drought | −1.80 | 12% |
| Wet / Recovery | +0.80 | 8% |

---

## Dataset Format

The model expects a CSV at `data/jay_dataset.csv` with these columns:

| Column | Type | Description |
|--------|------|-------------|
| `borrower_id` | string | Unique borrower identifier |
| `loan_id` | string | Unique loan identifier |
| `rating` | integer 1–5 | Credit rating (1 = default, 5 = best) |
| `obs_date` | date | Observation date (quarterly) |
| `district` | string | Borrower's district |
| `gamma` | float | SPEI drought index (negative = dry) |
| `default_flag` | 0 or 1 | 1 if borrower is in default this quarter |
| `loan_amount` | float | Outstanding loan balance (USD) |

---

## Further Reading

See `explanation/explanation.tex` (compile with `pdflatex`) for a full
plain-language guide covering:

- What the model does and why
- How each stage of the pipeline works
- What every chart and table in the app is showing
- The test suite in detail, with code listings
