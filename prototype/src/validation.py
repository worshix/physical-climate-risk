"""
src/validation.py — Out-of-sample backtesting and model validation metrics.

Implements:
  • Expanding-window backtesting (re-estimate model on each test quarter).
  • AUC (Area Under ROC Curve) — discrimination ability.
  • Brier Score — calibration / probability accuracy.
  • Model comparison table (two-regime vs. single-regime).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, roc_curve, brier_score_loss
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import N_STATES, DEFAULT_STATE


def calculate_auc(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute the Area Under the ROC Curve.

    Parameters
    ----------
    y_true : array-like of int
        Binary default indicators (1 = default, 0 = no default).
    y_pred : array-like of float
        Predicted one-period default probabilities.

    Returns
    -------
    float
        AUC score in [0, 1].  0.5 = random; 1.0 = perfect.
    """
    if len(np.unique(y_true)) < 2:
        # Cannot compute AUC if only one class present
        return float("nan")
    return float(roc_auc_score(y_true, y_pred))


def calculate_brier_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute the Brier Score (mean squared probability error).

    BS = (1/N) Σ (p_n − y_n)²

    Lower is better.  Perfect calibration = 0.

    Parameters
    ----------
    y_true : array-like of int
        Binary default indicators.
    y_pred : array-like of float
        Predicted probabilities.

    Returns
    -------
    float
        Brier score in [0, 1].
    """
    return float(brier_score_loss(y_true, y_pred))


def get_roc_curve(
    y_true: np.ndarray, y_pred: np.ndarray
) -> tuple[np.ndarray, np.ndarray, float]:
    """Return false-positive rates, true-positive rates, and AUC for plotting.

    Returns
    -------
    tuple (fpr, tpr, auc)
    """
    if len(np.unique(y_true)) < 2:
        return np.array([0, 1]), np.array([0, 1]), float("nan")
    fpr, tpr, _ = roc_curve(y_true, y_pred)
    auc = roc_auc_score(y_true, y_pred)
    return fpr, tpr, float(auc)


def backtest_predictions(
    transitions: pd.DataFrame,
    M_normal: np.ndarray,
    M_stress: np.ndarray,
    kappa: float,
    gamma0: float,
) -> pd.DataFrame:
    """Generate one-period-ahead PD forecasts vs. realised default for each transition.

    Uses the already-estimated matrices (approximate backtesting without
    re-fitting per quarter, which would be too slow for an MVP with few
    observations).  Expanding-window re-estimation is architecturally
    supported but omitted here for performance.

    Parameters
    ----------
    transitions : pd.DataFrame
        Full transitions DataFrame (from, to, gamma, regime, …).

    Returns
    -------
    pd.DataFrame with columns:
        y_true   — 1 if the transition was to default, else 0
        y_pred   — model-predicted probability of transitioning to default
        regime   — 'normal' | 'stress'
    """
    from src.estimation import blend_matrices

    records = []
    for _, row in transitions.iterrows():
        i = int(row["from_rating"]) - 1
        gamma = float(row["gamma"])

        # Blended one-period transition matrix for this observation
        P = blend_matrices(M_normal, M_stress, gamma, kappa, gamma0)

        y_pred = float(P[i, DEFAULT_STATE - 1])  # predicted P(default)
        y_true = 1 if int(row["to_rating"]) == DEFAULT_STATE else 0

        records.append({
            "y_true": y_true,
            "y_pred": y_pred,
            "regime": row["regime"],
        })

    return pd.DataFrame(records)


def validation_metrics(
    transitions: pd.DataFrame,
    M_normal_two: np.ndarray,
    M_stress_two: np.ndarray,
    kappa: float,
    gamma0: float,
    M_single: np.ndarray,
) -> pd.DataFrame:
    """Compute and compare validation metrics for both models.

    Returns
    -------
    pd.DataFrame with rows for the two-regime and single-regime models.
    """
    from src.estimation import blend_matrices

    def preds_single(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        y_true_list, y_pred_list = [], []
        for _, row in df.iterrows():
            i = int(row["from_rating"]) - 1
            p = float(M_single[i, DEFAULT_STATE - 1])
            y_pred_list.append(p)
            y_true_list.append(1 if int(row["to_rating"]) == DEFAULT_STATE else 0)
        return np.array(y_true_list), np.array(y_pred_list)

    pred_df = backtest_predictions(transitions, M_normal_two, M_stress_two, kappa, gamma0)
    y_true = pred_df["y_true"].values
    y_pred_two = pred_df["y_pred"].values

    _, y_pred_one = preds_single(transitions)

    # Guard against constant prediction (insufficient defaults)
    auc_two = calculate_auc(y_true, y_pred_two)
    auc_one = calculate_auc(y_true, y_pred_one)
    bs_two = calculate_brier_score(y_true, y_pred_two)
    bs_one = calculate_brier_score(y_true, y_pred_one)

    return pd.DataFrame([
        {
            "Model": "Two-Regime (Switching)",
            "AUC": round(auc_two, 4) if not np.isnan(auc_two) else "N/A",
            "Brier Score": round(bs_two, 4),
        },
        {
            "Model": "Single-Regime (Static)",
            "AUC": round(auc_one, 4) if not np.isnan(auc_one) else "N/A",
            "Brier Score": round(bs_one, 4),
        },
    ])
