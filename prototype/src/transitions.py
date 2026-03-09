"""
src/transitions.py — Rating transition extraction.

Responsibilities:
  • Sort observations by borrower and date.
  • Pair consecutive observations for each borrower to produce
    one-quarter transitions (rating_t → rating_{t+1}).
  • Attach the contemporaneous drought index γ_t to each transition.
  • Label transitions as normal / stress regime based on threshold.
  • Return a clean transitions DataFrame and empirical count matrices.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import DEFAULT_STATE, N_STATES, DROUGHT_THRESHOLD, DIRICHLET_DIAG, DIRICHLET_OFFDIAG


def extract_rating_transitions(df: pd.DataFrame) -> pd.DataFrame:
    """Extract one-period rating transitions from the panel dataset.

    For each borrower, consecutive observations are paired to produce a
    transition record (from_rating, to_rating, gamma_t).  Transitions
    FROM the absorbing default state (State 1) are excluded because the
    model treats default as absorbing — once a borrower defaults they
    remain in state 1 indefinitely.

    Parameters
    ----------
    df : pd.DataFrame
        Cleaned panel from ingestion.load_dataset.

    Returns
    -------
    pd.DataFrame
        Columns: borrower_id, from_rating, to_rating, gamma,
                 regime ('normal' | 'stress'), obs_date.
    """
    records = []

    for borrower_id, group in df.groupby("borrower_id"):
        group = group.sort_values("obs_date").reset_index(drop=True)

        for i in range(len(group) - 1):
            from_row = group.iloc[i]
            to_row = group.iloc[i + 1]

            from_rating = from_row["rating"]
            to_rating = to_row["rating"]
            gamma = from_row["gamma"]

            # Skip rows with missing rating or gamma
            if pd.isna(from_rating) or pd.isna(to_rating) or pd.isna(gamma):
                continue

            from_rating = int(from_rating)
            to_rating = int(to_rating)

            # Exclude transitions FROM the absorbing default state
            if from_rating == DEFAULT_STATE:
                continue

            regime = "stress" if gamma < DROUGHT_THRESHOLD else "normal"

            records.append({
                "borrower_id": borrower_id,
                "from_rating": from_rating,
                "to_rating": to_rating,
                "gamma": float(gamma),
                "regime": regime,
                "obs_date": from_row["obs_date"],
                "loan_amount": float(from_row.get("loan_amount", 0)),
            })

    return pd.DataFrame(records)


def build_count_matrix(
    transitions: pd.DataFrame,
    regime: str | None = None,
) -> np.ndarray:
    """Build a raw transition count matrix from the transitions DataFrame.

    Parameters
    ----------
    transitions : pd.DataFrame
        Output of extract_rating_transitions.
    regime : str | None
        If 'normal' or 'stress', filter to that regime only.
        If None, use all transitions (pooled / single-regime).

    Returns
    -------
    np.ndarray
        Shape (N_STATES, N_STATES) integer count matrix.
        Entry [i, j] = number of observed i → j transitions.
        Row 0 (State 1 / default) is always all-zeros (absorbing).
    """
    if regime is not None:
        subset = transitions[transitions["regime"] == regime]
    else:
        subset = transitions

    counts = np.zeros((N_STATES, N_STATES), dtype=int)

    for _, row in subset.iterrows():
        i = int(row["from_rating"]) - 1  # 0-indexed
        j = int(row["to_rating"]) - 1
        if 0 <= i < N_STATES and 0 <= j < N_STATES:
            counts[i, j] += 1

    return counts


def mle_matrix_from_counts(counts: np.ndarray) -> np.ndarray:
    """Convert a count matrix to a row-stochastic MLE probability matrix.

    Uses a symmetric Dirichlet MAP estimator (pseudo-count smoothing) to
    handle rows with zero or very few observations, preventing degenerate
    probability estimates.

    Parameters
    ----------
    counts : np.ndarray
        Shape (N_STATES, N_STATES) integer count matrix.

    Returns
    -------
    np.ndarray
        Row-stochastic probability matrix P where each row sums to 1.
    """
    K = counts.shape[0]
    P = np.zeros((K, K))

    # Row 0 (State 1 = default) is absorbing — stays at 1 with probability 1
    P[0, 0] = 1.0

    for i in range(1, K):  # rows for states 2..K
        row_counts = counts[i].astype(float)
        row_sum = row_counts.sum()

        if row_sum == 0:
            # No observations for this row — apply Dirichlet prior only
            prior = np.full(K, DIRICHLET_OFFDIAG)
            prior[i] = DIRICHLET_DIAG   # favour self-transition
            P[i] = prior / prior.sum()
        else:
            # MAP estimate: add pseudo-counts to observed counts
            prior = np.full(K, DIRICHLET_OFFDIAG)
            prior[i] = DIRICHLET_DIAG
            smoothed = row_counts + prior
            P[i] = smoothed / smoothed.sum()

    return P


def transition_summary(transitions: pd.DataFrame) -> dict:
    """Compute a summary of the extracted transitions for display."""
    return {
        "Total valid transitions": len(transitions),
        "Normal-regime (γ ≥ −1.0)": int((transitions["regime"] == "normal").sum()),
        "Stress-regime (γ < −1.0)": int((transitions["regime"] == "stress").sum()),
        "Unique borrowers": transitions["borrower_id"].nunique(),
        "Observed defaults (→ State 1)": int((transitions["to_rating"] == DEFAULT_STATE).sum()),
    }
