"""
app.py — Streamlit UI for the Physical Climate Risk ECL Prototype.

Pages (sidebar navigation):
  1. Dataset Overview
  2. Rating Transition Analysis
  3. Regime Model Estimation
  4. ECL Scenario Simulator
  5. Backtesting Metrics

All heavy computation is cached with @st.cache_data / @st.cache_resource
so that re-running the app on slider interactions does not re-fit the model.
"""

import os
import sys
import warnings
import numpy as np
import pandas as pd
import streamlit as st
import matplotlib
matplotlib.use("Agg")

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(__file__))

# ---------------------------------------------------------------------------
# Project imports
# ---------------------------------------------------------------------------
from config import (
    DATA_PATH, OUTPUT_CSV_DIR, OUTPUT_FIG_DIR,
    DEFAULT_LGD, DEFAULT_HORIZON, N_STATES, SCENARIOS,
)
from src.ingestion import load_dataset, dataset_summary
from src.transitions import (
    extract_rating_transitions,
    build_count_matrix,
    mle_matrix_from_counts,
    transition_summary,
)
from src.estimation import estimate_model, likelihood_ratio_test, single_regime_loglik
from src.svdm import compute_svdm, svdm_table, bootstrap_svdm_ci
from src.forecasting import portfolio_ecl, scenario_analysis, compute_ecl, blend_matrices
from src.validation import (
    backtest_predictions, validation_metrics,
    calculate_auc, calculate_brier_score, get_roc_curve,
)
from src.plots import (
    plot_migration_matrix, plot_matrix_comparison,
    plot_regime_weight, plot_spei_timeseries,
    plot_ecl_scenarios, plot_roc_curve,
    plot_pd_fan, plot_rating_distribution,
)

os.makedirs(OUTPUT_CSV_DIR, exist_ok=True)
os.makedirs(OUTPUT_FIG_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Cached data loaders (avoid recomputing on every interaction)
# ---------------------------------------------------------------------------

@st.cache_data(show_spinner="Loading dataset…")
def cached_load(path: str) -> pd.DataFrame:
    return load_dataset(path)


@st.cache_data(show_spinner="Extracting transitions…")
def cached_transitions(df_hash: str, _df: pd.DataFrame) -> pd.DataFrame:
    return extract_rating_transitions(_df)


@st.cache_data(show_spinner="Fitting two-regime model (this may take ~30 s)…")
def cached_model(_transitions: pd.DataFrame) -> dict:
    return estimate_model(_transitions)


# ---------------------------------------------------------------------------
# Page layout
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="Physical Climate Risk — ECL Prototype",
    page_icon="🌧️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Sidebar navigation
st.sidebar.image(
    "https://upload.wikimedia.org/wikipedia/en/thumb/b/b1/HIT_logo.svg/320px-HIT_logo.svg.png",
    use_container_width=True,
)
st.sidebar.title("Navigation")
PAGE = st.sidebar.radio(
    "Go to",
    [
        "1️⃣  Dataset Overview",
        "2️⃣  Transition Analysis",
        "3️⃣  Regime Model Estimation",
        "4️⃣  ECL Scenario Simulator",
        "5️⃣  Backtesting Metrics",
    ],
)
st.sidebar.markdown("---")
st.sidebar.caption("Kuwana Tadiwanaishe J · H220006Z\nMSc Financial Engineering · HIT 2026")

# ---------------------------------------------------------------------------
# Load data (shared across all pages)
# ---------------------------------------------------------------------------

try:
    df = cached_load(DATA_PATH)
except FileNotFoundError as e:
    st.error(str(e))
    st.stop()
except ValueError as e:
    st.error(f"Data validation failed: {e}")
    st.stop()

# Use a stable hash key for caching transitions
transitions = cached_transitions(str(len(df)), df)


# ============================================================
# PAGE 1 — Dataset Overview
# ============================================================

if PAGE.startswith("1"):
    st.title("🌍 Dataset Overview")
    st.markdown(
        "This page summarises the raw MFI panel dataset used for model estimation."
    )

    col1, col2 = st.columns([1, 1])

    with col1:
        st.subheader("Summary Statistics")
        summary = dataset_summary(df)
        for key, val in summary.items():
            st.metric(label=key, value=str(val))

    with col2:
        st.subheader("Rating Distribution")
        fig_dist = plot_rating_distribution(df)
        st.pyplot(fig_dist, use_container_width=True)

    st.subheader("SPEI Time Series")
    fig_spei = plot_spei_timeseries(df)
    st.pyplot(fig_spei, use_container_width=True)

    st.subheader("Raw Data Preview")
    n_rows = st.slider("Rows to display", 5, len(df), 20, key="raw_rows")
    st.dataframe(
        df.head(n_rows).style.format({"gamma": "{:.2f}", "loan_amount": "${:.0f}"}),
        use_container_width=True,
    )

    st.subheader("SPEI Distribution")
    col_a, col_b = st.columns(2)
    with col_a:
        st.write("**SPEI Descriptive Statistics**")
        st.dataframe(df["gamma"].describe().rename("γ (SPEI)").to_frame().T, use_container_width=True)
    with col_b:
        stress_pct = (df["gamma"] < -1.0).mean() * 100
        st.metric("Stress-regime observations (γ < −1.0)", f"{stress_pct:.1f}%")
        st.metric("Normal-regime observations (γ ≥ −1.0)", f"{100 - stress_pct:.1f}%")


# ============================================================
# PAGE 2 — Transition Analysis
# ============================================================

elif PAGE.startswith("2"):
    st.title("📊 Rating Transition Analysis")
    st.markdown(
        "Empirical one-quarter credit rating transitions extracted from the panel, "
        "split by climate regime."
    )

    ts = transition_summary(transitions)
    cols = st.columns(len(ts))
    for col, (k, v) in zip(cols, ts.items()):
        col.metric(k, str(v))

    st.markdown("---")

    tab_norm, tab_stress, tab_pool = st.tabs(
        ["Normal Regime", "Stress Regime", "Pooled (Single-Regime)"]
    )

    def _show_matrix_tab(regime_label: str | None, tab):
        counts = build_count_matrix(transitions, regime=regime_label)
        P = mle_matrix_from_counts(counts)
        with tab:
            col1, col2 = st.columns(2)
            with col1:
                st.write("**Transition Count Matrix**")
                labels = ["Default"] + [f"R{k}" for k in range(2, N_STATES + 1)]
                count_df = pd.DataFrame(counts, index=labels, columns=labels)
                st.dataframe(count_df, use_container_width=True)
            with col2:
                st.write("**MLE Probability Matrix**")
                prob_df = pd.DataFrame(
                    np.round(P, 4), index=labels, columns=labels
                )
                st.dataframe(
                    prob_df.style.background_gradient(cmap="Blues", axis=None, vmin=0, vmax=1),
                    use_container_width=True,
                )
            title = {
                "normal": "$\\hat{M}_{\\mathrm{normal}}$",
                "stress": "$\\hat{M}_{\\mathrm{stress}}$",
                None: "Pooled Matrix",
            }[regime_label]
            fig = plot_migration_matrix(P, title=title,
                                        cmap="Greens" if regime_label == "normal" else
                                             "Reds" if regime_label == "stress" else "Blues")
            st.pyplot(fig, use_container_width=True)

    _show_matrix_tab("normal", tab_norm)
    _show_matrix_tab("stress", tab_stress)
    _show_matrix_tab(None, tab_pool)

    st.markdown("---")
    st.subheader("Transition Records")
    n_t = st.slider("Rows", 10, len(transitions), 20, key="trans_rows")
    st.dataframe(transitions.head(n_t), use_container_width=True)


# ============================================================
# PAGE 3 — Regime Model Estimation
# ============================================================

elif PAGE.startswith("3"):
    st.title("⚙️ Two-Regime Model Estimation")
    st.markdown(
        r"""
The model estimates two migration matrices via **Maximum Likelihood Estimation**:

$$P(\gamma) = \omega(\gamma)\, \hat{M}_{\text{stress}} + (1-\omega(\gamma))\, \hat{M}_{\text{normal}}$$

where $\omega(\gamma) = \dfrac{1}{1 + e^{\kappa(\gamma - \gamma_0)}}$ increases toward 1 as drought worsens.
        """
    )

    with st.spinner("Estimating model…"):
        result = cached_model(transitions)

    # --- Convergence status ---
    if result["success"]:
        st.success(f"✅ Optimisation converged  —  {result['message']}")
    else:
        st.warning(f"⚠️ Optimisation did not fully converge: {result['message']}")

    # --- Key parameters ---
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("κ (sharpness)", f"{result['kappa']:.4f}")
    col2.metric("γ₀ (threshold)", f"{result['gamma0']:.4f}")
    col3.metric("Log-likelihood", f"{result['log_lik']:.2f}")
    col4.metric("Transitions used", result["n_transitions"])

    st.markdown("---")

    # --- Matrix comparison ---
    st.subheader("Estimated Migration Matrices")
    fig_compare = plot_matrix_comparison(result["M_normal"], result["M_stress"])
    st.pyplot(fig_compare, use_container_width=True)

    col_n, col_s = st.columns(2)
    labels = ["Default"] + [f"Rating {k}" for k in range(2, N_STATES + 1)]
    with col_n:
        st.write("**M_normal (Normal Regime)**")
        st.dataframe(
            pd.DataFrame(np.round(result["M_normal"], 4), index=labels, columns=labels),
            use_container_width=True,
        )
    with col_s:
        st.write("**M_stress (Drought-Stress Regime)**")
        st.dataframe(
            pd.DataFrame(np.round(result["M_stress"], 4), index=labels, columns=labels),
            use_container_width=True,
        )

    # --- Regime weight function ---
    st.subheader("Logistic Regime Weight Function  ω(γ)")
    fig_weight = plot_regime_weight(result["kappa"], result["gamma0"])
    st.pyplot(fig_weight, use_container_width=True)

    # --- LRT ---
    st.subheader("Likelihood Ratio Test (Two-Regime vs. Single-Regime)")
    lrt = likelihood_ratio_test(result, transitions)
    lrt_df = pd.DataFrame([lrt])
    st.dataframe(lrt_df, use_container_width=True)
    if lrt["reject_h0"]:
        st.success("✅ Reject H₀ at 5% — the two-regime model is a significant improvement.")
    else:
        st.info(
            f"ℹ️ Fail to reject H₀ (LR = {lrt['lr_stat']}, p = {lrt['p_value']}).  "
            "This is expected with a small illustrative dataset; the full RBZ panel "
            "would provide the statistical power for a definitive test."
        )

    # --- SVDM ---
    st.subheader("Singular Value Decomposition Metric (SVDM)")
    svdm_score = compute_svdm(result["M_normal"], result["M_stress"])
    with st.spinner("Computing bootstrap CI for SVDM…"):
        ci_low, ci_high = bootstrap_svdm_ci(transitions, n_reps=200)

    col_svdm1, col_svdm2, col_svdm3 = st.columns(3)
    col_svdm1.metric("SVDM", f"{svdm_score:.4f}")
    col_svdm2.metric("95% CI Lower", f"{ci_low:.4f}")
    col_svdm3.metric("95% CI Upper", f"{ci_high:.4f}")

    st.dataframe(svdm_table(result["M_normal"], result["M_stress"]), use_container_width=True)

    # --- Save outputs ---
    for name, mat in [("M_normal", result["M_normal"]), ("M_stress", result["M_stress"])]:
        pd.DataFrame(mat, index=labels, columns=labels).to_csv(
            os.path.join(OUTPUT_CSV_DIR, f"{name}.csv")
        )
    pd.DataFrame([{
        "SVDM": svdm_score, "CI_lower": ci_low, "CI_upper": ci_high,
        "kappa": result["kappa"], "gamma0": result["gamma0"],
    }]).to_csv(os.path.join(OUTPUT_CSV_DIR, "svdm_results.csv"), index=False)
    st.caption(f"Results saved to `{OUTPUT_CSV_DIR}/`.")


# ============================================================
# PAGE 4 — ECL Scenario Simulator
# ============================================================

elif PAGE.startswith("4"):
    st.title("💰 ECL Scenario Simulator")
    st.markdown("Compute IFRS 9-compliant Expected Credit Loss under multiple drought scenarios.")

    # Sidebar controls
    with st.sidebar:
        st.markdown("### ECL Parameters")
        lgd = st.slider("Loss Given Default (LGD)", 0.20, 0.80, DEFAULT_LGD, 0.05)
        horizon = st.slider("Forecast Horizon (quarters)", 4, 20, DEFAULT_HORIZON, 4)
        st.markdown("---")
        st.markdown("### Custom Scenario")
        custom_gamma = st.slider("Custom γ (SPEI override)", -3.0, 2.0, -1.5, 0.05)

    with st.spinner("Estimating model…"):
        result = cached_model(transitions)

    # Active loans = last observation per borrower with positive balance and non-default rating
    active_loans = (
        df[(df["loan_amount"] > 0) & (df["rating"] > 1)]
        .sort_values("obs_date")
        .groupby("borrower_id")
        .last()
        .reset_index()[["borrower_id", "rating", "loan_amount", "gamma"]]
    )

    # --- Current portfolio ECL ---
    st.subheader("Current Portfolio ECL")
    ecl_df = portfolio_ecl(
        active_loans,
        result["M_normal"], result["M_stress"],
        result["kappa"], result["gamma0"],
        lgd=lgd, horizon=horizon,
    )
    st.dataframe(
        ecl_df.style.format({
            "EAD ($)": "${:,.2f}",
            "ECL ($)": "${:,.2f}",
        }, na_rep=""),
        use_container_width=True,
    )

    # --- Scenario analysis ---
    st.subheader("Climate Scenario Analysis")

    custom_scenarios = SCENARIOS + [("Custom Scenario", custom_gamma, 0.0)]
    scenario_df = scenario_analysis(
        active_loans,
        result["M_normal"], result["M_stress"],
        result["kappa"], result["gamma0"],
        scenarios=[(l, g, p) for l, g, p in SCENARIOS],
        lgd=lgd, horizon=horizon,
    )
    st.dataframe(scenario_df, use_container_width=True)

    fig_ecl = plot_ecl_scenarios(scenario_df)
    st.pyplot(fig_ecl, use_container_width=True)

    # --- PD fan chart for a single borrower ---
    st.subheader("Cumulative PD by Scenario — Single Borrower")
    borrower_choice = st.selectbox("Select Borrower", active_loans["borrower_id"].tolist())
    borrower_row = active_loans[active_loans["borrower_id"] == borrower_choice].iloc[0]

    cum_pd_dict = {}
    for label, gamma_val, _ in SCENARIOS:
        P = blend_matrices(
            result["M_normal"], result["M_stress"],
            gamma_val, result["kappa"], result["gamma0"]
        )
        from src.forecasting import cumulative_pd
        cum = cumulative_pd(int(borrower_row["rating"]), P, horizon)
        cum_pd_dict[label] = cum

    fig_fan = plot_pd_fan(cum_pd_dict, horizon)
    st.pyplot(fig_fan, use_container_width=True)

    # --- Save outputs ---
    ecl_df.to_csv(os.path.join(OUTPUT_CSV_DIR, "ecl_forecasts.csv"), index=False)
    scenario_df.to_csv(os.path.join(OUTPUT_CSV_DIR, "ecl_scenarios.csv"), index=False)
    st.caption(f"ECL results saved to `{OUTPUT_CSV_DIR}/`.")


# ============================================================
# PAGE 5 — Backtesting Metrics
# ============================================================

elif PAGE.startswith("5"):
    st.title("📈 Backtesting & Validation Metrics")
    st.markdown(
        "Out-of-sample evaluation of the two-regime model against the static single-regime baseline."
    )

    with st.spinner("Estimating model and running backtest…"):
        result = cached_model(transitions)

    # Single-regime matrix for comparison
    counts_pool = build_count_matrix(transitions, regime=None)
    M_single = mle_matrix_from_counts(counts_pool)

    # Compute metrics
    metrics_df = validation_metrics(
        transitions,
        result["M_normal"], result["M_stress"],
        result["kappa"], result["gamma0"],
        M_single=M_single,
    )

    st.subheader("Model Comparison")
    st.dataframe(metrics_df, use_container_width=True)

    # --- ROC curve ---
    pred_df_two = backtest_predictions(
        transitions, result["M_normal"], result["M_stress"],
        result["kappa"], result["gamma0"]
    )
    y_true = pred_df_two["y_true"].values
    y_pred_two = pred_df_two["y_pred"].values

    # Single-regime predictions
    y_pred_one = np.array([
        float(M_single[int(r) - 1, 0])
        for r in transitions["from_rating"]
    ])

    fpr_two, tpr_two, auc_two = get_roc_curve(y_true, y_pred_two)
    fpr_one, tpr_one, auc_one = get_roc_curve(y_true, y_pred_one)

    col_roc, col_metrics = st.columns([1.4, 1])
    with col_roc:
        st.subheader("ROC Curves")
        fig_roc = plot_roc_curve(fpr_two, tpr_two, auc_two, fpr_one, tpr_one, auc_one)
        st.pyplot(fig_roc, use_container_width=True)

    with col_metrics:
        st.subheader("Key Metrics")
        st.metric("Two-Regime AUC", f"{auc_two:.4f}" if not np.isnan(auc_two) else "N/A")
        st.metric("Single-Regime AUC", f"{auc_one:.4f}" if not np.isnan(auc_one) else "N/A")
        bs_two = calculate_brier_score(y_true, y_pred_two)
        bs_one = calculate_brier_score(y_true, y_pred_one)
        st.metric("Two-Regime Brier Score", f"{bs_two:.4f}")
        st.metric("Single-Regime Brier Score", f"{bs_one:.4f}")
        if not np.isnan(auc_two) and not np.isnan(auc_one):
            improvement = (auc_two - auc_one) / auc_one * 100
            st.metric("AUC Improvement", f"{improvement:+.1f}%")

    # --- Calibration table ---
    st.subheader("Prediction Breakdown by Regime")
    for regime in ["normal", "stress"]:
        sub = pred_df_two[pred_df_two["regime"] == regime]
        if len(sub) > 0:
            defaults = sub["y_true"].sum()
            mean_pred = sub["y_pred"].mean()
            actual_rate = sub["y_true"].mean()
            st.markdown(
                f"**{regime.capitalize()} regime** — "
                f"{len(sub)} transitions, "
                f"{defaults} defaults ({actual_rate*100:.1f}%), "
                f"mean predicted PD = {mean_pred*100:.2f}%"
            )

    # --- Save outputs ---
    metrics_df.to_csv(os.path.join(OUTPUT_CSV_DIR, "backtesting_metrics.csv"), index=False)
    st.caption(f"Metrics saved to `{OUTPUT_CSV_DIR}/`.")
