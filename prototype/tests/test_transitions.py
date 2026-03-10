"""
tests/test_transitions.py — Stage 2: Rating Transition Extraction

Tests cover:
  1. Transitions FROM the absorbing default state (State 1) are excluded.
  2. Regime is labelled correctly relative to the drought threshold (γ = −1.0).
  3. build_count_matrix returns the correct shape (5 × 5).
  4. build_count_matrix correctly filters by regime.
  5. mle_matrix_from_counts returns a row-stochastic matrix.
  6. mle_matrix_from_counts makes row 0 (State 1) absorbing.
  7. Rows with zero observed counts get the Dirichlet prior (still sums to 1).
"""

import sys
import os
import unittest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.transitions import (
    extract_rating_transitions,
    build_count_matrix,
    mle_matrix_from_counts,
)
from config import N_STATES, DROUGHT_THRESHOLD


def _make_panel() -> pd.DataFrame:
    """Create a minimal panel DataFrame for testing (no CSV needed)."""
    rows = [
        # B01: 3 → 2 (normal, γ=−0.5) then 2 → 1 (stress, γ=−1.5)
        {"borrower_id": "B01", "rating": 3, "obs_date": pd.Timestamp("2022-03-31"),
         "gamma": -0.5, "loan_amount": 5000, "default_flag": 0, "district": "Harare", "loan_id": "L01"},
        {"borrower_id": "B01", "rating": 2, "obs_date": pd.Timestamp("2022-06-30"),
         "gamma": -1.5, "loan_amount": 4800, "default_flag": 0, "district": "Harare", "loan_id": "L01"},
        {"borrower_id": "B01", "rating": 1, "obs_date": pd.Timestamp("2022-09-30"),
         "gamma": -1.8, "loan_amount": 0,    "default_flag": 1, "district": "Harare", "loan_id": "L01"},
        # B02: 4 → 3 (normal, γ=+0.3) — only one valid transition
        {"borrower_id": "B02", "rating": 4, "obs_date": pd.Timestamp("2022-03-31"),
         "gamma":  0.3, "loan_amount": 8000, "default_flag": 0, "district": "Bulawayo", "loan_id": "L02"},
        {"borrower_id": "B02", "rating": 3, "obs_date": pd.Timestamp("2022-06-30"),
         "gamma":  0.2, "loan_amount": 7500, "default_flag": 0, "district": "Bulawayo", "loan_id": "L02"},
    ]
    return pd.DataFrame(rows)


class TestExtractRatingTransitions(unittest.TestCase):

    def setUp(self):
        self.panel = _make_panel()
        self.transitions = extract_rating_transitions(self.panel)

    def test_returns_dataframe(self):
        self.assertIsInstance(self.transitions, pd.DataFrame)

    def test_absorbing_state_excluded(self):
        """Transitions FROM State 1 (default) must never appear as from_rating."""
        self.assertTrue(
            (self.transitions["from_rating"] != 1).all(),
            "Found a transition FROM the absorbing State 1 — should be excluded."
        )

    def test_expected_transition_count(self):
        """B01 produces 2 valid transitions (3→2 normal, 2→1 stress).
        B02 produces 1 valid transition (4→3 normal).
        Total = 3."""
        self.assertEqual(len(self.transitions), 3)

    def test_regime_label_normal(self):
        """Observations with γ ≥ −1.0 should be labelled 'normal'."""
        normal_rows = self.transitions[self.transitions["gamma"] >= DROUGHT_THRESHOLD]
        self.assertTrue((normal_rows["regime"] == "normal").all())

    def test_regime_label_stress(self):
        """Observations with γ < −1.0 should be labelled 'stress'."""
        stress_rows = self.transitions[self.transitions["gamma"] < DROUGHT_THRESHOLD]
        self.assertTrue((stress_rows["regime"] == "stress").all())

    def test_required_columns_present(self):
        for col in ["borrower_id", "from_rating", "to_rating", "gamma", "regime"]:
            self.assertIn(col, self.transitions.columns)


class TestBuildCountMatrix(unittest.TestCase):

    def setUp(self):
        self.panel = _make_panel()
        self.transitions = extract_rating_transitions(self.panel)

    def test_shape(self):
        """Count matrix must be N_STATES × N_STATES."""
        counts = build_count_matrix(self.transitions)
        self.assertEqual(counts.shape, (N_STATES, N_STATES))

    def test_dtype_integer(self):
        counts = build_count_matrix(self.transitions)
        self.assertTrue(np.issubdtype(counts.dtype, np.integer))

    def test_normal_regime_filter(self):
        """Normal-regime matrix should not contain stress transitions."""
        counts_n = build_count_matrix(self.transitions, regime="normal")
        counts_s = build_count_matrix(self.transitions, regime="stress")
        # Total cells in both should sum to overall counts
        counts_all = build_count_matrix(self.transitions)
        np.testing.assert_array_equal(counts_n + counts_s, counts_all)

    def test_correct_cell_value(self):
        """The cell for 3→2 (row index 2, col index 1) should be ≥ 1."""
        counts = build_count_matrix(self.transitions)
        # row 2 = State 3 (0-indexed), col 1 = State 2 (0-indexed)
        self.assertGreaterEqual(counts[2, 1], 1)


class TestMleMatrixFromCounts(unittest.TestCase):

    def _make_counts(self) -> np.ndarray:
        """Counts with one full row and some zero rows."""
        counts = np.zeros((N_STATES, N_STATES), dtype=int)
        # State 3 (row 2) transitions to State 2 once and State 3 once
        counts[2, 1] = 1
        counts[2, 2] = 1
        return counts

    def test_row_stochastic(self):
        """Every row of the MLE matrix must sum to 1 (± 1e-9)."""
        counts = self._make_counts()
        P = mle_matrix_from_counts(counts)
        row_sums = P.sum(axis=1)
        np.testing.assert_allclose(row_sums, np.ones(N_STATES), atol=1e-9)

    def test_absorbing_state_row(self):
        """Row 0 (State 1 / default) must be [1, 0, 0, 0, 0]."""
        counts = self._make_counts()
        P = mle_matrix_from_counts(counts)
        expected = np.zeros(N_STATES)
        expected[0] = 1.0
        np.testing.assert_allclose(P[0], expected, atol=1e-12)

    def test_zero_count_row_uses_prior(self):
        """Rows with zero observations should still produce a valid probability row."""
        counts = np.zeros((N_STATES, N_STATES), dtype=int)
        P = mle_matrix_from_counts(counts)
        # All non-absorbing rows should still sum to 1
        for i in range(1, N_STATES):
            self.assertAlmostEqual(P[i].sum(), 1.0, places=9)

    def test_all_values_non_negative(self):
        """No probability should be negative."""
        counts = self._make_counts()
        P = mle_matrix_from_counts(counts)
        self.assertTrue((P >= 0).all())


if __name__ == "__main__":
    unittest.main(verbosity=2)
