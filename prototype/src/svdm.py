"""
src/svdm.py — Singular Value Decomposition Metric (SVDM).

The SVDM quantifies the structural distance between two migration matrices
by comparing their ordered singular values:

    SVDM(M₁, M₂) = Σₖ |σₖ(M₁) − σₖ(M₂)|

A larger SVDM indicates greater structural divergence between regimes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def compute_svdm(M_normal: np.ndarray, M_stress: np.ndarray) -> float:
    """Compute the SVDM between the normal and stress migration matrices.

    Parameters
    ----------
    M_normal : np.ndarray
        K×K row-stochastic normal-regime matrix.
    M_stress : np.ndarray
        K×K row-stochastic stress-regime matrix.

    Returns
    -------
    float
        The SVDM score (≥ 0).  Zero means identical matrices.
    """
    # Step 1: Compute singular values of both matrices (sorted descending)
    sigma_normal = np.linalg.svd(M_normal, compute_uv=False)
    sigma_stress = np.linalg.svd(M_stress, compute_uv=False)

    # Step 2: Compute element-wise absolute differences and sum
    svdm = float(np.sum(np.abs(sigma_normal - sigma_stress)))
    return svdm


def svdm_table(M_normal: np.ndarray, M_stress: np.ndarray) -> pd.DataFrame:
    """Return a DataFrame showing singular values of both matrices and their differences.

    Useful for displaying in the Streamlit UI.
    """
    sigma_normal = np.linalg.svd(M_normal, compute_uv=False)
    sigma_stress = np.linalg.svd(M_stress, compute_uv=False)
    diff = np.abs(sigma_normal - sigma_stress)

    K = len(sigma_normal)
    df = pd.DataFrame({
        "Singular Value": [f"σ{k+1}" for k in range(K)],
        "M_normal": np.round(sigma_normal, 4),
        "M_stress": np.round(sigma_stress, 4),
        "|Δσ|": np.round(diff, 4),
    })
    df.loc[len(df)] = ["SVDM (total)", "", "", round(diff.sum(), 4)]
    return df


def bootstrap_svdm_ci(
    transitions: "pd.DataFrame",  # noqa: F821
    n_reps: int = 200,
    seed: int = 42,
) -> tuple[float, float]:
    """Bootstrap 95% confidence interval for the SVDM.

    Resamples borrowers with replacement, re-estimates matrices from
    counts, and recomputes SVDM for each replicate.

    Parameters
    ----------
    transitions : pd.DataFrame
        Output of transitions.extract_rating_transitions.
    n_reps : int
        Number of bootstrap replications.
    seed : int
        Random seed for reproducibility.

    Returns
    -------
    tuple (lower, upper)
        The 2.5th and 97.5th percentiles of the bootstrap SVDM distribution.
    """
    from src.transitions import build_count_matrix, mle_matrix_from_counts

    rng = np.random.default_rng(seed)
    borrowers = transitions["borrower_id"].unique()
    svdm_boot = []

    for _ in range(n_reps):
        # Resample borrowers with replacement
        sampled = rng.choice(borrowers, size=len(borrowers), replace=True)
        boot_trans = pd.concat(
            [transitions[transitions["borrower_id"] == b] for b in sampled],
            ignore_index=True,
        )

        counts_n = build_count_matrix(boot_trans, regime="normal")
        counts_s = build_count_matrix(boot_trans, regime="stress")
        M_n = mle_matrix_from_counts(counts_n)
        M_s = mle_matrix_from_counts(counts_s)
        svdm_boot.append(compute_svdm(M_n, M_s))

    arr = np.array(svdm_boot)
    return float(np.percentile(arr, 2.5)), float(np.percentile(arr, 97.5))
