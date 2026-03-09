"""
src/plots.py — Visualisation functions for the Streamlit UI.

Each function returns a matplotlib Figure object so Streamlit can render it
with st.pyplot(fig).  No plt.show() calls are used — figures are returned
and explicitly closed by the caller.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")    # non-interactive backend for Streamlit
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.figure import Figure
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import N_STATES, DROUGHT_THRESHOLD


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _state_labels(K: int = N_STATES) -> list[str]:
    labels = ["Default"] + [f"Rating {k}" for k in range(2, K + 1)]
    return labels


# ---------------------------------------------------------------------------
# 1. Migration matrix heatmap
# ---------------------------------------------------------------------------

def plot_migration_matrix(
    matrix: np.ndarray,
    title: str = "Migration Matrix",
    cmap: str = "Blues",
) -> Figure:
    """Render a migration matrix as an annotated heatmap.

    Parameters
    ----------
    matrix : np.ndarray
        K×K row-stochastic transition probability matrix.
    title : str
        Figure title.
    cmap : str
        Matplotlib colourmap name.

    Returns
    -------
    matplotlib.figure.Figure
    """
    K = matrix.shape[0]
    labels = _state_labels(K)

    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(matrix, cmap=cmap, vmin=0, vmax=1, aspect="auto")
    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    ax.set_xticks(range(K))
    ax.set_yticks(range(K))
    ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=8)
    ax.set_yticklabels(labels, fontsize=8)
    ax.set_xlabel("To Rating", fontsize=9)
    ax.set_ylabel("From Rating", fontsize=9)
    ax.set_title(title, fontsize=11, fontweight="bold", pad=10)

    # Annotate cells with probability values
    for i in range(K):
        for j in range(K):
            val = matrix[i, j]
            text_color = "white" if val > 0.65 else "black"
            ax.text(j, i, f"{val:.3f}", ha="center", va="center",
                    fontsize=7, color=text_color)

    fig.tight_layout()
    return fig


def plot_matrix_comparison(
    M_normal: np.ndarray,
    M_stress: np.ndarray,
) -> Figure:
    """Side-by-side heatmap comparing normal and stress matrices."""
    K = M_normal.shape[0]
    labels = _state_labels(K)

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    for ax, matrix, title, cmap in zip(
        axes,
        [M_normal, M_stress],
        ["$\\hat{M}_{\\mathrm{normal}}$", "$\\hat{M}_{\\mathrm{stress}}$"],
        ["Greens", "Reds"],
    ):
        im = ax.imshow(matrix, cmap=cmap, vmin=0, vmax=1, aspect="auto")
        plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
        ax.set_xticks(range(K))
        ax.set_yticks(range(K))
        ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=8)
        ax.set_yticklabels(labels, fontsize=8)
        ax.set_xlabel("To", fontsize=9)
        ax.set_ylabel("From", fontsize=9)
        ax.set_title(title, fontsize=12, fontweight="bold")
        for i in range(K):
            for j in range(K):
                val = matrix[i, j]
                text_color = "white" if val > 0.6 else "black"
                ax.text(j, i, f"{val:.3f}", ha="center", va="center",
                        fontsize=7, color=text_color)

    fig.suptitle("Migration Matrix Comparison: Normal vs. Stress Regime",
                 fontsize=12, fontweight="bold", y=1.01)
    fig.tight_layout()
    return fig


# ---------------------------------------------------------------------------
# 2. Regime weight function
# ---------------------------------------------------------------------------

def plot_regime_weight(kappa: float, gamma0: float) -> Figure:
    """Plot ω(γ) — the logistic regime weight function.

    Shows the probability of being in the drought-stress regime
    as a function of the SPEI drought index γ.
    """
    gamma_range = np.linspace(-3.0, 2.0, 300)
    omega = 1.0 / (1.0 + np.exp(kappa * (gamma_range - gamma0)))

    fig, ax = plt.subplots(figsize=(7, 4))
    ax.plot(gamma_range, omega, color="steelblue", linewidth=2.2,
            label=f"ω(γ)  [κ={kappa:.2f}, γ₀={gamma0:.2f}]")
    ax.axvline(gamma0, color="red", linestyle="--", linewidth=1.2,
               label=f"Threshold γ₀ = {gamma0:.2f}")
    ax.axhline(0.5, color="grey", linestyle=":", linewidth=1, alpha=0.6)

    # Shade regimes
    ax.fill_between(gamma_range, omega, 0,
                    where=(gamma_range < gamma0),
                    alpha=0.12, color="red", label="Drought-stress region")
    ax.fill_between(gamma_range, omega, 0,
                    where=(gamma_range >= gamma0),
                    alpha=0.08, color="green", label="Normal region")

    ax.set_xlabel("SPEI Drought Index (γ)", fontsize=10)
    ax.set_ylabel("Stress Regime Weight  ω(γ)", fontsize=10)
    ax.set_title("Logistic Regime Weight Function", fontsize=11, fontweight="bold")
    ax.set_ylim(-0.05, 1.05)
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    return fig


# ---------------------------------------------------------------------------
# 3. SPEI time series with regime shading
# ---------------------------------------------------------------------------

def plot_spei_timeseries(df: pd.DataFrame) -> Figure:
    """Plot the SPEI time series with drought-stress periods shaded."""
    # Use the longest borrower series as representative
    longest = (
        df.groupby("borrower_id")
        .size()
        .idxmax()
    )
    series = df[df["borrower_id"] == longest].sort_values("obs_date")

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(series["obs_date"], series["gamma"], color="steelblue",
            linewidth=1.8, marker="o", markersize=3)
    ax.axhline(DROUGHT_THRESHOLD, color="red", linestyle="--",
               linewidth=1.2, label=f"Threshold γ₀ = {DROUGHT_THRESHOLD}")
    ax.fill_between(series["obs_date"], series["gamma"], DROUGHT_THRESHOLD,
                    where=(series["gamma"] < DROUGHT_THRESHOLD),
                    alpha=0.25, color="red", label="Drought-stress regime")
    ax.fill_between(series["obs_date"], series["gamma"], DROUGHT_THRESHOLD,
                    where=(series["gamma"] >= DROUGHT_THRESHOLD),
                    alpha=0.10, color="green", label="Normal regime")
    ax.set_xlabel("Date", fontsize=10)
    ax.set_ylabel("SPEI (γ)", fontsize=10)
    ax.set_title(f"SPEI Time Series — Borrower {longest}", fontsize=11, fontweight="bold")
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    return fig


# ---------------------------------------------------------------------------
# 4. ECL scenario bar chart
# ---------------------------------------------------------------------------

def plot_ecl_scenarios(scenario_df: pd.DataFrame) -> Figure:
    """Bar chart of ECL by climate scenario.

    Parameters
    ----------
    scenario_df : pd.DataFrame
        Output of forecasting.scenario_analysis.
    """
    # Exclude the summary row
    plot_df = scenario_df[scenario_df["ECL ($)"] != "—"].copy()
    plot_df["ECL ($)"] = plot_df["ECL ($)"].astype(float)

    colours = ["#2196F3", "#FF9800", "#f44336", "#4CAF50"]
    fig, ax = plt.subplots(figsize=(7, 4))
    bars = ax.bar(plot_df["Scenario"], plot_df["ECL ($)"],
                  color=colours[: len(plot_df)], width=0.55, edgecolor="white")

    # Annotate bars
    for bar, val in zip(bars, plot_df["ECL ($)"]):
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 1,
                f"${val:,.0f}",
                ha="center", va="bottom", fontsize=8, fontweight="bold")

    # Expected ECL horizontal line
    expected_row = scenario_df[scenario_df["Scenario"].str.startswith("EXPECTED")]
    if not expected_row.empty:
        exp_ecl = float(expected_row["Weighted ECL ($)"].iloc[0])
        ax.axhline(exp_ecl, color="black", linestyle="--", linewidth=1.2,
                   label=f"Expected ECL = ${exp_ecl:,.0f}")
        ax.legend(fontsize=8)

    ax.set_xlabel("Climate Scenario", fontsize=10)
    ax.set_ylabel("Portfolio ECL ($)", fontsize=10)
    ax.set_title("ECL by Climate Scenario (Lifetime)", fontsize=11, fontweight="bold")
    plt.xticks(rotation=15, ha="right", fontsize=9)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    return fig


# ---------------------------------------------------------------------------
# 5. ROC curve
# ---------------------------------------------------------------------------

def plot_roc_curve(
    fpr_two: np.ndarray,
    tpr_two: np.ndarray,
    auc_two: float,
    fpr_one: np.ndarray | None = None,
    tpr_one: np.ndarray | None = None,
    auc_one: float | None = None,
) -> Figure:
    """Plot ROC curves for the two-regime and (optionally) single-regime models."""
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr_two, tpr_two, color="steelblue", linewidth=2,
            label=f"Two-Regime  AUC = {auc_two:.3f}")
    if fpr_one is not None and tpr_one is not None:
        ax.plot(fpr_one, tpr_one, color="tomato", linewidth=2, linestyle="--",
                label=f"Single-Regime  AUC = {auc_one:.3f}")
    ax.plot([0, 1], [0, 1], "k:", linewidth=1, label="Random (AUC = 0.50)")
    ax.set_xlabel("False Positive Rate", fontsize=10)
    ax.set_ylabel("True Positive Rate", fontsize=10)
    ax.set_title("ROC Curve — Default Prediction", fontsize=11, fontweight="bold")
    ax.legend(fontsize=9)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    return fig


# ---------------------------------------------------------------------------
# 6. Cumulative PD fan chart
# ---------------------------------------------------------------------------

def plot_pd_fan(
    cum_pd_dict: dict[str, np.ndarray],
    horizon: int,
) -> Figure:
    """Plot cumulative PD paths for multiple scenarios."""
    fig, ax = plt.subplots(figsize=(7, 4))
    quarters = np.arange(1, horizon + 1)
    colours = ["#2196F3", "#FF9800", "#f44336", "#4CAF50"]

    for (label, cum_pd), colour in zip(cum_pd_dict.items(), colours):
        ax.plot(quarters, cum_pd * 100, linewidth=2, label=label, color=colour)

    ax.set_xlabel("Forecast Horizon (quarters)", fontsize=10)
    ax.set_ylabel("Cumulative PD (%)", fontsize=10)
    ax.set_title("Cumulative Default Probability by Scenario", fontsize=11, fontweight="bold")
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    return fig


# ---------------------------------------------------------------------------
# 7. Rating distribution bar chart
# ---------------------------------------------------------------------------

def plot_rating_distribution(df: pd.DataFrame) -> Figure:
    """Bar chart of credit rating frequencies in the dataset."""
    counts = df["rating"].value_counts().sort_index()
    colours = ["#f44336", "#FF9800", "#FFC107", "#4CAF50", "#2196F3"]

    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(
        [f"Rating {int(r)}" for r in counts.index],
        counts.values,
        color=colours[: len(counts)],
        edgecolor="white",
    )
    for bar, val in zip(bars, counts.values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
                str(val), ha="center", fontsize=9, fontweight="bold")

    ax.set_ylabel("Observations", fontsize=10)
    ax.set_title("Credit Rating Distribution", fontsize=11, fontweight="bold")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    return fig
