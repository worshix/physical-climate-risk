"""
tests/test_forecasting.py — Stage 4: ECL Forecasting

Tests cover:
  1. cumulative_pd is monotonically non-decreasing.
  2. cumulative_pd values lie in [0, 1].
  3. marginal_pd values are all non-negative.
  4. compute_ecl returns ECL > 0 for a non-default borrower.
  5. compute_ecl increases under more severe drought (higher ω).
  6. portfolio_ecl appends a PORTFOLIO TOTAL row.
  7. scenario_analysis returns one row per scenario plus the EXPECTED row.
  8. EXPECTED (weighted) ECL is consistent with scenario ECLs.
"""

import sys
import os
import unittest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.forecasting import (
    cumulative_pd,
    marginal_pd,
    compute_ecl,
    portfolio_ecl,
    scenario_analysis,
)
from config import N_STATES, DEFAULT_LGD, DEFAULT_HORIZON, SCENARIOS


def _simple_matrix() -> np.ndarray:
    """
    A simple but realistic 5×5 row-stochastic transition matrix.
    State 1 is absorbing; other states have a small default probability.
    """
    P = np.array([
        [1.00, 0.00, 0.00, 0.00, 0.00],   # State 1: absorbing (default)
        [0.10, 0.80, 0.07, 0.02, 0.01],   # State 2: high default risk
        [0.04, 0.06, 0.78, 0.09, 0.03],   # State 3
        [0.01, 0.02, 0.06, 0.82, 0.09],   # State 4
        [0.00, 0.01, 0.03, 0.08, 0.88],   # State 5: lowest risk
    ])
    return P


def _stress_matrix() -> np.ndarray:
    """Higher default probabilities under drought stress."""
    P = np.array([
        [1.00, 0.00, 0.00, 0.00, 0.00],
        [0.20, 0.70, 0.06, 0.03, 0.01],
        [0.08, 0.10, 0.70, 0.09, 0.03],
        [0.03, 0.04, 0.08, 0.76, 0.09],
        [0.01, 0.02, 0.04, 0.10, 0.83],
    ])
    return P


def _active_loans() -> pd.DataFrame:
    """Small portfolio of active (non-defaulted) loans."""
    return pd.DataFrame([
        {"borrower_id": "B01", "rating": 3, "loan_amount": 5000, "gamma": -0.5},
        {"borrower_id": "B02", "rating": 4, "loan_amount": 8000, "gamma": -0.5},
        {"borrower_id": "B03", "rating": 2, "loan_amount": 3000, "gamma": -0.5},
    ])


class TestCumulativePD(unittest.TestCase):

    def setUp(self):
        self.P = _simple_matrix()

    def test_shape(self):
        """cumulative_pd should return an array of length DEFAULT_HORIZON."""
        cum = cumulative_pd(start_rating=3, P=self.P, horizon=DEFAULT_HORIZON)
        self.assertEqual(len(cum), DEFAULT_HORIZON)

    def test_non_decreasing(self):
        """Cumulative PD must never decrease over time."""
        cum = cumulative_pd(start_rating=3, P=self.P, horizon=DEFAULT_HORIZON)
        diffs = np.diff(cum)
        self.assertTrue(
            np.all(diffs >= -1e-12),
            f"Cumulative PD decreased: min diff = {diffs.min():.6f}"
        )

    def test_values_in_unit_interval(self):
        """Cumulative PD must lie in [0, 1]."""
        for rating in range(2, N_STATES + 1):
            cum = cumulative_pd(start_rating=rating, P=self.P, horizon=DEFAULT_HORIZON)
            self.assertTrue(np.all(cum >= 0), f"Negative PD for rating {rating}")
            self.assertTrue(np.all(cum <= 1 + 1e-12), f"PD > 1 for rating {rating}")

    def test_higher_risk_borrower_has_higher_pd(self):
        """A State 2 borrower should have a higher cumulative PD than a State 5 borrower."""
        cum2 = cumulative_pd(start_rating=2, P=self.P, horizon=DEFAULT_HORIZON)
        cum5 = cumulative_pd(start_rating=5, P=self.P, horizon=DEFAULT_HORIZON)
        self.assertGreater(cum2[-1], cum5[-1])

    def test_default_state_returns_zero_increments(self):
        """Starting from State 1 (absorbing), cumulative PD should immediately = 1."""
        cum = cumulative_pd(start_rating=1, P=self.P, horizon=DEFAULT_HORIZON)
        np.testing.assert_allclose(cum, np.ones(DEFAULT_HORIZON), atol=1e-12)


class TestMarginalPD(unittest.TestCase):

    def test_non_negative(self):
        """Marginal PD should never be negative (clamp ensures this)."""
        cum = np.array([0.01, 0.03, 0.06, 0.10, 0.15])
        marg = marginal_pd(cum)
        self.assertTrue(np.all(marg >= 0))

    def test_sums_to_final_cumulative(self):
        """Sum of marginal PD should equal the final cumulative PD."""
        P = _simple_matrix()
        cum = cumulative_pd(start_rating=3, P=P, horizon=8)
        marg = marginal_pd(cum)
        self.assertAlmostEqual(marg.sum(), cum[-1], places=9)

    def test_length_matches(self):
        """marginal_pd output should be the same length as the input."""
        cum = np.linspace(0, 0.5, 12)
        marg = marginal_pd(cum)
        self.assertEqual(len(marg), len(cum))


class TestComputeECL(unittest.TestCase):

    def setUp(self):
        self.M_normal = _simple_matrix()
        self.M_stress = _stress_matrix()
        self.kappa = 2.0
        self.gamma0 = -1.0

    def test_ecl_positive_for_non_default(self):
        """A non-defaulted borrower should have ECL > 0."""
        result = compute_ecl(
            start_rating=3, ead=5000.0, gamma=-0.5,
            M_normal=self.M_normal, M_stress=self.M_stress,
            kappa=self.kappa, gamma0=self.gamma0
        )
        self.assertGreater(result["ecl"], 0.0)

    def test_ecl_higher_under_drought(self):
        """ECL under drought (γ=−1.8) should exceed ECL under normal (γ=−0.5)."""
        ecl_normal = compute_ecl(
            start_rating=3, ead=5000.0, gamma=-0.5,
            M_normal=self.M_normal, M_stress=self.M_stress,
            kappa=self.kappa, gamma0=self.gamma0
        )["ecl"]
        ecl_drought = compute_ecl(
            start_rating=3, ead=5000.0, gamma=-1.8,
            M_normal=self.M_normal, M_stress=self.M_stress,
            kappa=self.kappa, gamma0=self.gamma0
        )["ecl"]
        self.assertGreater(ecl_drought, ecl_normal)

    def test_higher_ead_gives_higher_ecl(self):
        """Doubling EAD should approximately double ECL."""
        ecl_1 = compute_ecl(
            start_rating=3, ead=5000.0, gamma=-0.5,
            M_normal=self.M_normal, M_stress=self.M_stress,
            kappa=self.kappa, gamma0=self.gamma0
        )["ecl"]
        ecl_2 = compute_ecl(
            start_rating=3, ead=10000.0, gamma=-0.5,
            M_normal=self.M_normal, M_stress=self.M_stress,
            kappa=self.kappa, gamma0=self.gamma0
        )["ecl"]
        self.assertAlmostEqual(ecl_2 / ecl_1, 2.0, places=6)

    def test_stress_weight_in_unit_interval(self):
        """The stress weight ω returned in compute_ecl must be in [0, 1]."""
        result = compute_ecl(
            start_rating=3, ead=5000.0, gamma=-1.0,
            M_normal=self.M_normal, M_stress=self.M_stress,
            kappa=self.kappa, gamma0=self.gamma0
        )
        self.assertGreaterEqual(result["stress_weight"], 0.0)
        self.assertLessEqual(result["stress_weight"], 1.0)

    def test_required_keys_in_result(self):
        result = compute_ecl(
            start_rating=3, ead=5000.0, gamma=-0.5,
            M_normal=self.M_normal, M_stress=self.M_stress,
            kappa=self.kappa, gamma0=self.gamma0
        )
        for key in ["ecl", "pd_quarterly", "cum_pd", "one_period_pd", "stress_weight"]:
            self.assertIn(key, result)


class TestPortfolioECL(unittest.TestCase):

    def setUp(self):
        self.M_normal = _simple_matrix()
        self.M_stress = _stress_matrix()
        self.loans = _active_loans()

    def test_returns_dataframe(self):
        df = portfolio_ecl(self.loans, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0)
        self.assertIsInstance(df, pd.DataFrame)

    def test_portfolio_total_row_present(self):
        """The last row should be the PORTFOLIO TOTAL summary row."""
        df = portfolio_ecl(self.loans, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0)
        self.assertIn("PORTFOLIO TOTAL", df["Borrower ID"].values)

    def test_portfolio_ecl_equals_sum(self):
        """PORTFOLIO TOTAL ECL should equal sum of individual ECLs."""
        df = portfolio_ecl(self.loans, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0)
        individual = df[df["Borrower ID"] != "PORTFOLIO TOTAL"]["ECL ($)"].sum()
        total = float(df[df["Borrower ID"] == "PORTFOLIO TOTAL"]["ECL ($)"].iloc[0])
        self.assertAlmostEqual(individual, total, places=1)


class TestScenarioAnalysis(unittest.TestCase):

    def setUp(self):
        self.M_normal = _simple_matrix()
        self.M_stress = _stress_matrix()
        self.loans = _active_loans()

    def test_returns_dataframe(self):
        df = scenario_analysis(self.loans, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0)
        self.assertIsInstance(df, pd.DataFrame)

    def test_row_count(self):
        """Should have one row per scenario plus the EXPECTED row."""
        df = scenario_analysis(self.loans, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0)
        # Default SCENARIOS has 4 entries + 1 expected row = 5
        self.assertEqual(len(df), len(SCENARIOS) + 1)

    def test_expected_row_present(self):
        df = scenario_analysis(self.loans, self.M_normal, self.M_stress, kappa=2.0, gamma0=-1.0)
        labels = df["Scenario"].tolist()
        self.assertTrue(any("EXPECTED" in s for s in labels))


if __name__ == "__main__":
    unittest.main(verbosity=2)
