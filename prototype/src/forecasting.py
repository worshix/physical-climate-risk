"""
src/forecasting.py — ECL forecasting and scenario analysis.

ECL Formula (IFRS 9 lifetime):

    ECL = Σ_{h=1}^{H}  DF(h) × EAD_{t+h} × LGD × PD_{t→t+h}(i)

Where:
    DF(h)        = (1 + r)^{−h/4}      quarterly discount factor
    PD_{t→t+h}   = [P(γ)^h]_{i, 0}     cumulative default prob from state i
    P(γ)         = ω(γ)·M_stress + (1−ω(γ))·M_normal
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import (
    DEFAULT_LGD, DEFAULT_DISCOUNT_RATE, DEFAULT_HORIZON,
    N_STATES, SCENARIOS, DEFAULT_STATE,
)
from src.estimation import blend_matrices


def cumulative_pd(
    start_rating: int,
    P: np.ndarray,
    horizon: int = DEFAULT_HORIZON,
) -> np.ndarray:
    """Compute cumulative default probability from a starting rating over H quarters.

    Uses matrix exponentiation: [P^h]_{i, default_state−1}

    Parameters
    ----------
    start_rating : int
        Current credit rating (1-indexed).
    P : np.ndarray
        K×K transition probability matrix for the current period.
    horizon : int
        Forecast horizon in quarters.

    Returns
    -------
    np.ndarray
        Array of length H with the cumulative PD at each quarter.
    """
    i = start_rating - 1        # convert to 0-indexed
    default_col = DEFAULT_STATE - 1   # column for the default state (0-indexed)
    K = P.shape[0]

    cumulative = np.zeros(horizon)
    P_power = np.eye(K)   # P^0 = identity

    for h in range(1, horizon + 1):
        P_power = P_power @ P
        cumulative[h - 1] = P_power[i, default_col]

    return cumulative


def marginal_pd(cumulative: np.ndarray) -> np.ndarray:
    """Convert a cumulative PD series to marginal (period-by-period) PD.

    marginal_h = cumulative_h − cumulative_{h−1}

    Clamps to zero to prevent numerical artefacts from matrix operations.
    """
    marginal = np.diff(cumulative, prepend=0.0)
    return np.maximum(marginal, 0.0)


def compute_ecl(
    start_rating: int,
    ead: float,
    gamma: float,
    M_normal: np.ndarray,
    M_stress: np.ndarray,
    kappa: float,
    gamma0: float,
    lgd: float = DEFAULT_LGD,
    discount_rate: float = DEFAULT_DISCOUNT_RATE,
    horizon: int = DEFAULT_HORIZON,
) -> dict:
    """Compute the discounted lifetime ECL for a single loan.

    Parameters
    ----------
    start_rating : int
        Borrower's current credit rating (1-indexed).
    ead : float
        Exposure At Default (outstanding principal, $).
    gamma : float
        Current SPEI drought index.
    M_normal, M_stress : np.ndarray
        Estimated regime migration matrices.
    kappa, gamma0 : float
        Estimated logistic regime-switching parameters.
    lgd : float
        Loss Given Default (fraction, default 0.45).
    discount_rate : float
        Annual discount rate (default 0.05).
    horizon : int
        Forecast horizon in quarters.

    Returns
    -------
    dict with:
        ecl          — total discounted lifetime ECL ($)
        pd_quarterly — marginal PD per quarter (array)
        cum_pd       — cumulative PD per quarter (array)
    """
    P = blend_matrices(M_normal, M_stress, gamma, kappa, gamma0)
    cum = cumulative_pd(start_rating, P, horizon)
    marg = marginal_pd(cum)

    # Quarterly discount factors: DF(h) = (1+r)^{-h/4}
    h_arr = np.arange(1, horizon + 1)
    discount_factors = (1.0 + discount_rate) ** (-h_arr / 4.0)

    # Discounted ECL: assume EAD is constant over horizon for simplicity
    ecl = float(np.sum(discount_factors * ead * lgd * marg))

    return {
        "ecl": round(ecl, 2),
        "pd_quarterly": marg,
        "cum_pd": cum,
        "one_period_pd": float(P[start_rating - 1, DEFAULT_STATE - 1]),
        "stress_weight": float(1.0 / (1.0 + np.exp(kappa * (gamma - gamma0)))),
    }


def portfolio_ecl(
    active_loans: pd.DataFrame,
    M_normal: np.ndarray,
    M_stress: np.ndarray,
    kappa: float,
    gamma0: float,
    lgd: float = DEFAULT_LGD,
    discount_rate: float = DEFAULT_DISCOUNT_RATE,
    horizon: int = DEFAULT_HORIZON,
) -> pd.DataFrame:
    """Compute ECL for every active loan in the portfolio.

    Parameters
    ----------
    active_loans : pd.DataFrame
        Must contain columns: borrower_id, rating, loan_amount, gamma.

    Returns
    -------
    pd.DataFrame
        One row per loan with ECL, cumulative PD, and stress weight.
    """
    results = []
    for _, row in active_loans.iterrows():
        if pd.isna(row["rating"]) or pd.isna(row["loan_amount"]) or row["loan_amount"] <= 0:
            continue

        result = compute_ecl(
            start_rating=int(row["rating"]),
            ead=float(row["loan_amount"]),
            gamma=float(row["gamma"]),
            M_normal=M_normal,
            M_stress=M_stress,
            kappa=kappa,
            gamma0=gamma0,
            lgd=lgd,
            discount_rate=discount_rate,
            horizon=horizon,
        )
        results.append({
            "Borrower ID": row["borrower_id"],
            "Rating": int(row["rating"]),
            "EAD ($)": float(row["loan_amount"]),
            "γ": round(float(row["gamma"]), 2),
            "Stress Weight ω": round(result["stress_weight"], 3),
            "1Q PD": round(result["one_period_pd"], 4),
            f"{horizon//4}Y Cum. PD": round(result["cum_pd"][-1], 4),
            "ECL ($)": result["ecl"],
        })

    df = pd.DataFrame(results)
    if not df.empty:
        total_row = {col: "" for col in df.columns}
        total_row["Borrower ID"] = "PORTFOLIO TOTAL"
        total_row["EAD ($)"] = df["EAD ($)"].sum()
        total_row["ECL ($)"] = round(df["ECL ($)"].sum(), 2)
        df = pd.concat([df, pd.DataFrame([total_row])], ignore_index=True)
    return df


def scenario_analysis(
    active_loans: pd.DataFrame,
    M_normal: np.ndarray,
    M_stress: np.ndarray,
    kappa: float,
    gamma0: float,
    scenarios: list[tuple[str, float, float]] | None = None,
    lgd: float = DEFAULT_LGD,
    horizon: int = DEFAULT_HORIZON,
) -> pd.DataFrame:
    """Compute portfolio-level ECL under multiple climate scenarios.

    Parameters
    ----------
    active_loans : pd.DataFrame
        Subset of the panel with the last observation per active borrower.
    scenarios : list of (label, gamma_value, probability_weight)
        Climate paths. Defaults to config.SCENARIOS.

    Returns
    -------
    pd.DataFrame
        One row per scenario with ECL and weighted contribution.
    """
    if scenarios is None:
        scenarios = SCENARIOS

    rows = []
    weighted_ecl = 0.0

    for label, gamma_val, prob in scenarios:
        # Override gamma for all loans with the scenario value
        loans_overridden = active_loans.copy()
        loans_overridden["gamma"] = gamma_val

        ecl_df = portfolio_ecl(
            loans_overridden, M_normal, M_stress, kappa, gamma0,
            lgd=lgd, horizon=horizon,
        )
        # Total ECL is the last row (PORTFOLIO TOTAL)
        total_ecl = float(ecl_df[ecl_df["Borrower ID"] == "PORTFOLIO TOTAL"]["ECL ($)"].iloc[0])
        weighted_ecl += prob * total_ecl

        rows.append({
            "Scenario": label,
            "γ override": gamma_val,
            "Probability": f"{int(prob*100)}%",
            "ECL ($)": round(total_ecl, 2),
            "Weighted ECL ($)": round(prob * total_ecl, 2),
        })

    rows.append({
        "Scenario": "EXPECTED (probability-weighted)",
        "γ override": "—",
        "Probability": "100%",
        "ECL ($)": "—",
        "Weighted ECL ($)": round(weighted_ecl, 2),
    })

    return pd.DataFrame(rows)
