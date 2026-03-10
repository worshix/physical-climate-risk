"""
tests/test_validation.py — Stage 5: Backtesting and Model Validation

Tests cover:
  1. calculate_auc returns NaN when only one class is present.
  2. calculate_auc returns a value in [0, 1] for two classes.
  3. calculate_brier_score returns 0 for perfect predictions.
  4. calculate_brier_score returns a positive value for imperfect predictions.
  5. get_roc_curve returns arrays of equal length for fpr and tpr.
  6. backtest_predictions returns a DataFrame with y_true and y_pred columns.
  7. y_true values are binary (0 or 1).
  8. y_pred values lie in [0, 1].
  9. validation_metrics returns exactly 2 rows (two-regime vs single-regime).
"""

import sys
import os
import unittest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.validation import (
    calculate_auc,
    calculate_brier_score,
    get_roc_curve,
    backtest_predictions,
    validation_metrics,
)
from config import N_STATES


def _simple_matrix(default_prob: float = 0.05) -> np.ndarray:
    """Row-stochastic matrix with a controlled default probability."""
    K = N_STATES
    P = np.zeros((K, K))
    P[0, 0] = 1.0   # State 1 absorbing
    for i in range(1, K):
        P[i, 0] = default_prob          # probability of defaulting
        P[i, i] = 1.0 - default_prob   # self-transition
    return P


def _make_transitions_with_defaults() -> pd.DataFrame:
    """Transitions that include both defaults and non-defaults for AUC computation."""
    rows = [
        # defaults (to_rating = 1)
        {"borrower_id": "B01", "from_rating": 2, "to_rating": 1, "gamma": -1.5, "regime": "stress"},
        {"borrower_id": "B02", "from_rating": 3, "to_rating": 1, "gamma": -1.8, "regime": "stress"},
        # non-defaults
        {"borrower_id": "B03", "from_rating": 4, "to_rating": 4, "gamma": -0.5, "regime": "normal"},
        {"borrower_id": "B04", "from_rating": 5, "to_rating": 4, "gamma":  0.3, "regime": "normal"},
        {"borrower_id": "B05", "from_rating": 3, "to_rating": 3, "gamma": -0.2, "regime": "normal"},
        {"borrower_id": "B06", "from_rating": 2, "to_rating": 2, "gamma": -1.2, "regime": "stress"},
    ]
    return pd.DataFrame(rows)


class TestCalculateAUC(unittest.TestCase):

    def test_returns_nan_single_class(self):
        """AUC should return NaN when only one class is present in y_true."""
        y_true = np.array([0, 0, 0, 0])   # no defaults
        y_pred = np.array([0.1, 0.2, 0.3, 0.4])
        result = calculate_auc(y_true, y_pred)
        self.assertTrue(np.isnan(result))

    def test_perfect_predictions_return_one(self):
        """Perfect discriminator should return AUC = 1.0."""
        y_true = np.array([1, 1, 0, 0])
        y_pred = np.array([0.9, 0.8, 0.1, 0.2])
        result = calculate_auc(y_true, y_pred)
        self.assertAlmostEqual(result, 1.0, places=6)

    def test_random_predictions_near_half(self):
        """Uninformative predictor should give AUC ≈ 0.5."""
        rng = np.random.default_rng(42)
        y_true = np.array([1, 0, 1, 0, 1, 0, 1, 0])
        y_pred = rng.uniform(0, 1, size=8)
        result = calculate_auc(y_true, y_pred)
        self.assertGreaterEqual(result, 0.0)
        self.assertLessEqual(result, 1.0)

    def test_output_in_unit_interval(self):
        y_true = np.array([1, 0, 1, 0, 0])
        y_pred = np.array([0.7, 0.3, 0.6, 0.2, 0.4])
        result = calculate_auc(y_true, y_pred)
        self.assertGreaterEqual(result, 0.0)
        self.assertLessEqual(result, 1.0)


class TestCalculateBrierScore(unittest.TestCase):

    def test_perfect_predictions_return_zero(self):
        """Brier score for perfect predictions should be 0."""
        y_true = np.array([1, 0, 1, 0])
        y_pred = np.array([1.0, 0.0, 1.0, 0.0])
        result = calculate_brier_score(y_true, y_pred)
        self.assertAlmostEqual(result, 0.0, places=9)

    def test_worst_predictions_return_one(self):
        """Completely wrong predictions give Brier score = 1."""
        y_true = np.array([1, 0, 1, 0])
        y_pred = np.array([0.0, 1.0, 0.0, 1.0])
        result = calculate_brier_score(y_true, y_pred)
        self.assertAlmostEqual(result, 1.0, places=9)

    def test_non_negative(self):
        """Brier score must always be ≥ 0."""
        y_true = np.array([1, 0, 0, 1, 0])
        y_pred = np.array([0.6, 0.3, 0.2, 0.8, 0.1])
        result = calculate_brier_score(y_true, y_pred)
        self.assertGreaterEqual(result, 0.0)


class TestGetROCCurve(unittest.TestCase):

    def test_returns_tuple_of_three(self):
        y_true = np.array([1, 0, 1, 0])
        y_pred = np.array([0.8, 0.2, 0.7, 0.3])
        result = get_roc_curve(y_true, y_pred)
        self.assertEqual(len(result), 3)

    def test_fpr_tpr_same_length(self):
        y_true = np.array([1, 0, 1, 0])
        y_pred = np.array([0.8, 0.2, 0.7, 0.3])
        fpr, tpr, auc = get_roc_curve(y_true, y_pred)
        self.assertEqual(len(fpr), len(tpr))

    def test_single_class_returns_diagonal(self):
        """When only one class is present, fallback diagonal should be returned."""
        y_true = np.array([0, 0, 0])
        y_pred = np.array([0.1, 0.2, 0.3])
        fpr, tpr, auc = get_roc_curve(y_true, y_pred)
        self.assertTrue(np.isnan(auc))


class TestBacktestPredictions(unittest.TestCase):

    def setUp(self):
        self.transitions = _make_transitions_with_defaults()
        self.M_normal = _simple_matrix(default_prob=0.04)
        self.M_stress = _simple_matrix(default_prob=0.12)

    def test_returns_dataframe(self):
        df = backtest_predictions(
            self.transitions, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0
        )
        self.assertIsInstance(df, pd.DataFrame)

    def test_required_columns(self):
        df = backtest_predictions(
            self.transitions, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0
        )
        for col in ["y_true", "y_pred", "regime"]:
            self.assertIn(col, df.columns)

    def test_y_true_is_binary(self):
        """y_true must only contain 0 or 1."""
        df = backtest_predictions(
            self.transitions, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0
        )
        self.assertTrue(set(df["y_true"].unique()).issubset({0, 1}))

    def test_y_pred_in_unit_interval(self):
        """All predicted default probabilities must lie in [0, 1]."""
        df = backtest_predictions(
            self.transitions, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0
        )
        self.assertTrue((df["y_pred"] >= 0.0).all())
        self.assertTrue((df["y_pred"] <= 1.0).all())

    def test_row_count_matches_transitions(self):
        """One prediction row per transition."""
        df = backtest_predictions(
            self.transitions, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0
        )
        self.assertEqual(len(df), len(self.transitions))


class TestValidationMetrics(unittest.TestCase):

    def setUp(self):
        self.transitions = _make_transitions_with_defaults()
        self.M_normal = _simple_matrix(default_prob=0.04)
        self.M_stress = _simple_matrix(default_prob=0.12)
        # Single-regime matrix
        from src.transitions import build_count_matrix, mle_matrix_from_counts
        counts = build_count_matrix(self.transitions, regime=None)
        self.M_single = mle_matrix_from_counts(counts)

    def test_returns_dataframe(self):
        df = validation_metrics(
            self.transitions,
            self.M_normal, self.M_stress,
            kappa=2.0, gamma0=-1.0,
            M_single=self.M_single,
        )
        self.assertIsInstance(df, pd.DataFrame)

    def test_returns_two_rows(self):
        """Should return exactly 2 rows — one per model."""
        df = validation_metrics(
            self.transitions,
            self.M_normal, self.M_stress,
            kappa=2.0, gamma0=-1.0,
            M_single=self.M_single,
        )
        self.assertEqual(len(df), 2)

    def test_model_column_values(self):
        """Model names should clearly distinguish the two models."""
        df = validation_metrics(
            self.transitions,
            self.M_normal, self.M_stress,
            kappa=2.0, gamma0=-1.0,
            M_single=self.M_single,
        )
        models = df["Model"].tolist()
        self.assertTrue(any("Two" in m or "Switching" in m for m in models))
        self.assertTrue(any("Single" in m or "Static" in m for m in models))


if __name__ == "__main__":
    unittest.main(verbosity=2)
