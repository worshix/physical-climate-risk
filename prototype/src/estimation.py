"""
src/estimation.py — Two-Regime Markov-Switching Model estimation.

Model
-----
The conditional one-period transition matrix is a soft mixture of two
regime-specific matrices weighted by a logistic function of the drought
index γ:

    P(γ) = ω(γ) · M_stress  +  (1 − ω(γ)) · M_normal

Where the regime weight is:

    ω(γ) = 1 / (1 + exp(κ · (γ − γ₀)))

Convention:  γ ≪ γ₀  →  ω → 1  (drought regime, all weight on M_stress)
             γ ≫ γ₀  →  ω → 0  (normal regime, all weight on M_normal)
(Note: this is the DECREASING logistic, i.e. no minus sign before κ.)

Estimation via Maximum Likelihood (L-BFGS-B).  Rows are reparameterised
with the softmax to enforce valid probability constraints during optimisation.
"""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize
from scipy.special import softmax
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import (
    N_STATES, DEFAULT_STATE, KAPPA_INIT, GAMMA0_INIT,
    MAX_ITER, GRAD_TOL, DIRICHLET_DIAG, DIRICHLET_OFFDIAG,
)


# ---------------------------------------------------------------------------
# Regime weight function
# ---------------------------------------------------------------------------

def regime_weight(gamma: float | np.ndarray, kappa: float, gamma0: float) -> float | np.ndarray:
    """Compute ω(γ): probability of being in the drought-stress regime.

    Uses a DECREASING logistic so that lower γ (drought) gives ω → 1.

    Parameters
    ----------
    gamma : float or array-like
        SPEI drought index value(s).
    kappa : float
        Steepness / sharpness of the regime switch (> 0).
    gamma0 : float
        Threshold SPEI level (drought onset, typically around −1.0).

    Returns
    -------
    float or np.ndarray
        Stress weight ω ∈ (0, 1).
    """
    # Decreasing logistic: ω = σ(−κ(γ − γ₀)) = 1/(1 + exp(κ(γ − γ₀)))
    # Clip the exponent to [-500, 500] to avoid float overflow
    exponent = np.clip(kappa * (gamma - gamma0), -500.0, 500.0)
    return 1.0 / (1.0 + np.exp(exponent))


def blend_matrices(
    M_normal: np.ndarray,
    M_stress: np.ndarray,
    gamma: float,
    kappa: float,
    gamma0: float,
) -> np.ndarray:
    """Return the blended transition matrix P(γ) for a given drought index.

    P(γ) = ω(γ) · M_stress + (1 − ω(γ)) · M_normal
    """
    w = regime_weight(gamma, kappa, gamma0)
    return w * M_stress + (1.0 - w) * M_normal


# ---------------------------------------------------------------------------
# Softmax parameterisation
# ---------------------------------------------------------------------------

def softmax_to_row(theta_row: np.ndarray) -> np.ndarray:
    """Convert unconstrained logit vector (length K−1) to a probability row.

    The K-th state probability is the implicit reference category (set to
    avoid over-parameterisation).  Enforces non-negativity and row-sum = 1.
    """
    # Append zero for the reference category then apply softmax
    logits = np.concatenate([theta_row, [0.0]])
    return softmax(logits)


def params_to_matrices(
    theta: np.ndarray,
    K: int = N_STATES,
) -> tuple[np.ndarray, np.ndarray, float, float]:
    """Unpack flat parameter vector into (M_normal, M_stress, kappa, gamma0).

    Layout of theta:
      [0 : (K-1)*(K-1)]          — unconstrained rows for M_normal (rows 2..K)
      [(K-1)*(K-1) : 2*(K-1)^2]  — unconstrained rows for M_stress
      [-2]                        — kappa  (log-scale to enforce positivity)
      [-1]                        — gamma0 (unconstrained)
    """
    n_free_rows = K - 1          # rows 2..K (state 1 is absorbing, excluded)
    n_per_row = K - 1            # K−1 free logits per row (K-th is reference)
    block = n_free_rows * n_per_row

    theta_norm = theta[:block].reshape(n_free_rows, n_per_row)
    theta_stress = theta[block:2 * block].reshape(n_free_rows, n_per_row)
    log_kappa = theta[2 * block]
    gamma0 = theta[2 * block + 1]

    kappa = np.exp(log_kappa)  # enforce κ > 0

    # Build M_normal
    M_normal = np.zeros((K, K))
    M_normal[0, 0] = 1.0   # state 1 is absorbing
    for i in range(n_free_rows):
        M_normal[i + 1] = softmax_to_row(theta_norm[i])

    # Build M_stress
    M_stress = np.zeros((K, K))
    M_stress[0, 0] = 1.0
    for i in range(n_free_rows):
        M_stress[i + 1] = softmax_to_row(theta_stress[i])

    return M_normal, M_stress, kappa, gamma0


# ---------------------------------------------------------------------------
# Log-likelihood
# ---------------------------------------------------------------------------

def log_likelihood(
    theta: np.ndarray,
    transitions: "pd.DataFrame",  # noqa: F821
    K: int = N_STATES,
    dirichlet_alpha: float = 0.5,
) -> float:
    """Compute the negative log-likelihood (for minimisation).

    Includes a log-prior (Dirichlet MAP) term to regularise sparse rows.

    Parameters
    ----------
    theta : np.ndarray
        Flat parameter vector (see params_to_matrices for layout).
    transitions : pd.DataFrame
        Output of transitions.extract_rating_transitions.
    K : int
        Number of rating states.
    dirichlet_alpha : float
        Symmetric Dirichlet concentration parameter for the log-prior.

    Returns
    -------
    float
        Negative MAP log-likelihood (minimised by scipy.optimize).
    """
    M_normal, M_stress, kappa, gamma0 = params_to_matrices(theta, K)

    ll = 0.0
    for _, row in transitions.iterrows():
        i = int(row["from_rating"]) - 1  # 0-indexed
        j = int(row["to_rating"]) - 1
        gamma = float(row["gamma"])

        w = regime_weight(gamma, kappa, gamma0)
        p_ij = w * M_stress[i, j] + (1.0 - w) * M_normal[i, j]

        # Clip to avoid log(0)
        p_ij = np.clip(p_ij, 1e-12, 1.0)
        ll += np.log(p_ij)

    # --- Dirichlet log-prior on transition rows (MAP regularisation) ---
    # log P(M) = Σ_i Σ_j (α_j − 1) log m_ij   (for α_j = dirichlet_alpha)
    for M in (M_normal, M_stress):
        for i in range(1, K):          # skip absorbing row 0
            for j in range(K):
                alpha_j = DIRICHLET_DIAG if i == j else DIRICHLET_OFFDIAG
                ll += (alpha_j - 1.0) * np.log(np.clip(M[i, j], 1e-12, 1.0))

    return -ll  # return negative for minimisation


# ---------------------------------------------------------------------------
# Main estimation function (two-stage: counts → MAP matrices, then MLE for κ, γ₀)
# ---------------------------------------------------------------------------

def _neg_loglik_regime_params(
    phi: np.ndarray,
    transitions: "pd.DataFrame",  # noqa: F821
    M_normal: np.ndarray,
    M_stress: np.ndarray,
) -> float:
    """Negative log-likelihood for (κ, γ₀) with matrices held fixed.

    phi[0] = log(κ),  phi[1] = γ₀
    """
    kappa = np.exp(np.clip(phi[0], -4, 4))
    gamma0 = phi[1]
    ll = 0.0
    for _, row in transitions.iterrows():
        i = int(row["from_rating"]) - 1
        j = int(row["to_rating"]) - 1
        gamma = float(row["gamma"])
        w = regime_weight(gamma, kappa, gamma0)
        p_ij = np.clip(w * M_stress[i, j] + (1.0 - w) * M_normal[i, j], 1e-12, 1.0)
        ll += np.log(p_ij)
    return -ll


def estimate_model(
    transitions: "pd.DataFrame",  # noqa: F821
    K: int = N_STATES,
    kappa_init: float = KAPPA_INIT,
    gamma0_init: float = GAMMA0_INIT,
) -> dict:
    """Estimate the two-regime Markov-switching model.

    Two-stage approach for robustness on small samples:
      1. Estimate M_normal and M_stress directly from regime-classified
         counts using MAP (Dirichlet-smoothed MLE).  This is the exact MLE
         when regime membership is known (hard threshold).
      2. Optimise only (κ, γ₀) with matrices fixed to find the soft-mixture
         parameters that best describe the data.

    Parameters
    ----------
    transitions : pd.DataFrame
        Output of transitions.extract_rating_transitions.

    Returns
    -------
    dict with: M_normal, M_stress, kappa, gamma0, log_lik, success, message.
    """
    if len(transitions) == 0:
        raise ValueError("No transitions available for estimation.")

    from src.transitions import build_count_matrix, mle_matrix_from_counts

    # Stage 1 — estimate regime matrices from hard-threshold counts
    counts_n = build_count_matrix(transitions, regime="normal")
    counts_s = build_count_matrix(transitions, regime="stress")
    M_normal = mle_matrix_from_counts(counts_n)
    M_stress = mle_matrix_from_counts(counts_s)

    # Stage 2 — optimise (κ, γ₀) with matrices fixed
    phi0 = np.array([np.log(kappa_init), gamma0_init])
    bounds = [(-4.0, 4.0), (-3.0, 0.5)]   # log(κ) and γ₀

    result = minimize(
        fun=_neg_loglik_regime_params,
        x0=phi0,
        args=(transitions, M_normal, M_stress),
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": MAX_ITER, "ftol": GRAD_TOL, "gtol": GRAD_TOL},
    )

    kappa = float(np.exp(np.clip(result.x[0], -4, 4)))
    gamma0 = float(result.x[1])
    log_lik = float(-result.fun)

    return {
        "M_normal": M_normal,
        "M_stress": M_stress,
        "kappa": kappa,
        "gamma0": gamma0,
        "log_lik": log_lik,
        "success": result.success,
        "message": result.message,
        "n_params": 2 * (K - 1) * (K - 1) + 2,  # total conceptual params
        "n_transitions": len(transitions),
    }


def pure_loglik(
    transitions: "pd.DataFrame",  # noqa: F821
    M_normal: np.ndarray,
    M_stress: np.ndarray,
    kappa: float,
    gamma0: float,
) -> float:
    """Pure log-likelihood (no prior) for the two-regime model at given parameters."""
    ll = 0.0
    for _, row in transitions.iterrows():
        i = int(row["from_rating"]) - 1
        j = int(row["to_rating"]) - 1
        gamma = float(row["gamma"])
        w = regime_weight(gamma, kappa, gamma0)
        p_ij = np.clip(w * M_stress[i, j] + (1.0 - w) * M_normal[i, j], 1e-12, 1.0)
        ll += np.log(p_ij)
    return ll


def single_regime_loglik(transitions: "pd.DataFrame", K: int = N_STATES) -> float:  # noqa: F821
    """Compute the pure log-likelihood of the pooled single-regime model.

    Used as the null-hypothesis baseline for the Likelihood Ratio Test.
    """
    from src.transitions import build_count_matrix, mle_matrix_from_counts
    counts = build_count_matrix(transitions, regime=None)
    P_single = mle_matrix_from_counts(counts)

    ll = 0.0
    for _, row in transitions.iterrows():
        i = int(row["from_rating"]) - 1
        j = int(row["to_rating"]) - 1
        p = np.clip(P_single[i, j], 1e-12, 1.0)
        ll += np.log(p)
    return ll


def likelihood_ratio_test(model_result: dict, transitions: "pd.DataFrame") -> dict:  # noqa: F821
    """Perform a Likelihood Ratio Test: two-regime vs. single-regime.

    Returns
    -------
    dict with LR statistic, degrees of freedom, and p-value.
    """
    from scipy.stats import chi2

    # Use pure log-likelihood (no MAP prior) for a valid LRT comparison
    ll_two = pure_loglik(
        transitions,
        model_result["M_normal"], model_result["M_stress"],
        model_result["kappa"], model_result["gamma0"],
    )
    ll_single = single_regime_loglik(transitions)

    lr_stat = 2.0 * (ll_two - ll_single)

    # df = extra parameters in two-regime model relative to single-regime
    K = N_STATES
    params_single = (K - 1) * (K - 1)         # rows 2..K, K-1 free per row
    params_two = 2 * (K - 1) * (K - 1) + 2   # two matrices + κ, γ₀
    df = params_two - params_single

    p_value = 1.0 - chi2.cdf(lr_stat, df=df)

    return {
        "ll_single": round(ll_single, 4),
        "ll_two": round(ll_two, 4),
        "lr_stat": round(lr_stat, 4),
        "df": df,
        "p_value": round(p_value, 4),
        "reject_h0": p_value < 0.05,
    }
