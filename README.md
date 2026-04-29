# Mitiga Global Analytics Engine — AgriFin Risk Monitor

## User Guide

A web-based prototype for computing IFRS 9 Expected Credit Loss (ECL) on agricultural microfinance portfolios using satellite-derived drought data and a Two-Regime Markov-Switching model.

---

## Logging In

Open the application in your browser. You will see a login screen.

**Admin (Credit Officer) credentials:**

- Email: `admin@agrifin.local`
- Password: `changeme123`

Borrowers log in with the email and password set when the admin registers them.

---

## Who Does What

| Role | What they can do |
| --- | --- |
| **Admin (you)** | Register borrowers, add loans, compute ECL, view portfolio risk |
| **Borrower (farmer)** | Log in, draw their farm on the map, run a satellite analysis, view their health report |

---

## Step-by-Step: Running a Credit Risk Assessment

### Step 1 — Register a Borrower

1. Log in as admin and go to **Dashboard**.
2. Click **Register Borrower**.
3. Fill in the borrower's name, email, a temporary password, and their profile details (district, national ID, etc.).
4. Click **Create Borrower**. They can now log in with those credentials.

### Step 2 — Borrower Sets Up Their Farm (Satellite Data)

The borrower logs in on their own device:

1. They go to **My Field** and click **Register Field**.
2. They draw a polygon on the satellite map around their farm.
3. They click **Run Analysis**. The system fetches real-time NDVI, rainfall, temperature, and computes the **SPEI-3 drought index (γ)** for their location.

This γ value is the climate input that feeds directly into the ECL model.

> If the borrower has not done this yet, you can still compute ECL using the historical average γ = −0.73 (baseline scenario).

### Step 3 — Add a Loan

1. As admin, open the borrower from the **Dashboard** and go to their detail page.
2. Scroll down to the **Loans & Credit Risk (IFRS 9)** section.
3. Click **Add Loan** and fill in:
   - **Loan Reference** — your internal loan ID (e.g. `LN-2024-001`)
   - **Loan Amount / EAD** — the current outstanding balance in USD
   - **Current Rating** — the borrower's credit rating on a 1–5 scale (1 = default/impaired, 5 = best/strong)
   - **Disbursement Date**
   - **IFRS 9 Stage** — Stage 1 (12-month ECL), Stage 2 (lifetime ECL, significant credit deterioration), or Stage 3 (credit-impaired)
   - **Loan Status** — Active, Default, or Repaid
4. Click **Create Loan**.

### Step 4 — Compute ECL

1. On the borrower's detail page, find the loan in the **Loans & Credit Risk** section.
2. Click **Compute ECL**.

The system will automatically:

- Use the γ from the borrower's latest satellite analysis (or −0.73 if none exists)
- Blend the Normal and Stress migration matrices using ω(γ)
- Compute the 1-year and 5-year discounted ECL
- Compute four IFRS 9 forward-looking scenarios

Results appear immediately below the loan.

---

## Understanding the ECL Output

After computing ECL you will see:

| Field | Meaning |
| --- | --- |
| **1-Year ECL** | Expected Credit Loss over the next 12 months — the standard IFRS 9 Stage 1 provision |
| **5-Year ECL** | Lifetime ECL over 20 quarters — used for Stage 2/3 provisioning |
| **Expected ECL** | The probability-weighted average across all four scenarios |
| **PD (1 Quarter)** | Probability of Default in the next quarter, from the blended transition matrix |

### The Four IFRS 9 Scenarios

| Scenario | γ value | Probability | What it means |
| --- | --- | --- | --- |
| Baseline | −0.73 | 55% | Normal historical conditions |
| Moderate Drought | −1.20 | 25% | Below-average rainfall, mild stress |
| Severe Drought | −1.80 | 12% | Extreme drought — stress matrix dominates |
| Wet Recovery | +0.80 | 8% | Above-average rainfall, low default risk |

The Expected ECL is: `0.55 × Baseline + 0.25 × Moderate + 0.12 × Severe + 0.08 × Wet`

### The Regime Weight ω(γ)

ω(γ) tells you how much weight the stress migration matrix gets. It is a number between 0 and 1:

- **ω close to 0** — Normal regime. The normal transition matrix drives credit migration probabilities.
- **ω close to 1** — Drought-stress regime. The stress matrix dominates; default probabilities are elevated.
- The switch happens around γ = −1.10 (the drought threshold γ₀).

---

## Adding Rating Observations (Quarterly History)

To build a credit history for a loan, you can record quarterly rating observations:

1. Expand the loan, scroll to **Rating Observations**, and click **Add Observation**.
2. Enter the period (e.g. `2024Q3`), the date, the rating at that period, the outstanding balance, and the γ (SPEI-3) value for that quarter.
3. Tick **Default event** if the borrower was in default at that point.

These observations document the borrower's rating migration history and the drought conditions at each quarter.

---

## Portfolio View

Go to **Portfolio** in the top navigation. This page shows two sections:

### IFRS 9 Credit Risk

- Total portfolio EAD (Exposure at Default)
- Total 1-year ECL and probability-weighted Expected ECL across all active loans
- Scenario ECL breakdown (Baseline / Moderate Drought / Severe Drought / Wet Recovery)
- Credit rating distribution (how many loans at each rating)
- Per-loan table with individual ECL, PD, γ, and ω(γ)

### Climate Portfolio Overview

- Average SPEI-3 drought index across all borrowers
- Distribution of borrowers by drought regime (Wet, Mildly Dry, Moderate Drought, Severe Drought)
- Average NDVI vegetation index
- Count of water stress and disease risk flags

---

## Generating a Borrower Report

On any borrower's detail page, click **Generate Report** (top right). This produces a printable report covering:

1. Borrower profile
2. Loan details and IFRS 9 staging
3. Climate drought signal (γ and regime label)
4. Agricultural health (NDVI, rainfall, temperature, score)
5. Credit risk metrics (1Y ECL, 5Y ECL, PD)
6. Full scenario analysis table
7. Agronomic recommendations

Use your browser's **Print** function (Ctrl+P / Cmd+P) to save as PDF.

---

## Rating Scale Reference

| Rating | Label | Description |
| --- | --- | --- |
| 1 | Default / Impaired | Borrower has defaulted or is credit-impaired |
| 2 | High Risk | Significant credit deterioration observed |
| 3 | Moderate | Performing loan with some warning signs |
| 4 | Satisfactory | Healthy loan, minimal concerns |
| 5 | Strong / Best | Excellent credit quality |

---

## Model Parameters (For Reference)

The underlying model is a Two-Regime Markov-Switching model calibrated to the research dataset:

| Parameter | Value | Meaning |
| --- | --- | --- |
| κ | 1.25 | Logistic switching sharpness |
| γ₀ | −1.10 | Drought threshold (regime switch point) |
| LGD | 45% | Loss Given Default |
| Discount rate | 5% | Quarterly discounting for ECL calculation |

These parameters were estimated via Maximum Likelihood Estimation on the MFI panel dataset (6 borrowers, 59 quarterly observations, 2018–2024).
