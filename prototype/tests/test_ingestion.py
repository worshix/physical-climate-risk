"""
tests/test_ingestion.py — Stage 1: Data Loading and Validation

Tests cover:
  1. FileNotFoundError raised for a bad path.
  2. ValueError raised when required columns are missing.
  3. ValueError raised when ratings are outside [1, 5].
  4. Successful load returns correct dtypes and sorted order.
  5. dataset_summary returns a dict with the expected keys.
"""

import sys
import os
import unittest
import tempfile
import pandas as pd

# Add prototype root to path so we can import config and src.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.ingestion import load_dataset, validate_dataset, dataset_summary


# ---------------------------------------------------------------------------
# Minimal valid CSV content (4 observations, 2 borrowers)
# ---------------------------------------------------------------------------
VALID_CSV = """\
borrower_id,loan_id,rating,obs_date,district,gamma,default_flag,loan_amount
B01,L01,3,2022-03-31,Harare,-0.50,0,5000
B01,L01,2,2022-06-30,Harare,-1.20,0,4800
B02,L02,4,2022-03-31,Bulawayo,0.30,0,8000
B02,L02,1,2022-06-30,Bulawayo,-1.50,1,0
"""

BAD_RATING_CSV = """\
borrower_id,loan_id,rating,obs_date,district,gamma,default_flag,loan_amount
B01,L01,9,2022-03-31,Harare,-0.50,0,5000
"""

MISSING_COL_CSV = """\
borrower_id,loan_id,rating,obs_date,district,gamma,default_flag
B01,L01,3,2022-03-31,Harare,-0.50,0
"""


def _write_temp_csv(content: str) -> str:
    """Write content to a temporary CSV and return its path."""
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False)
    tmp.write(content)
    tmp.close()
    return tmp.name


class TestLoadDataset(unittest.TestCase):

    def test_file_not_found(self):
        """load_dataset should raise FileNotFoundError for a non-existent path."""
        with self.assertRaises(FileNotFoundError):
            load_dataset("/does/not/exist.csv")

    def test_valid_csv_loads(self):
        """load_dataset should return a DataFrame for a valid CSV."""
        path = _write_temp_csv(VALID_CSV)
        try:
            df = load_dataset(path)
            self.assertIsInstance(df, pd.DataFrame)
            self.assertEqual(len(df), 4)
        finally:
            os.unlink(path)

    def test_columns_present(self):
        """Loaded DataFrame should contain all required columns."""
        path = _write_temp_csv(VALID_CSV)
        try:
            df = load_dataset(path)
            for col in ["borrower_id", "rating", "obs_date", "gamma", "loan_amount"]:
                self.assertIn(col, df.columns)
        finally:
            os.unlink(path)

    def test_rating_dtype_is_numeric(self):
        """rating column should be numeric after loading."""
        path = _write_temp_csv(VALID_CSV)
        try:
            df = load_dataset(path)
            self.assertTrue(pd.api.types.is_numeric_dtype(df["rating"]))
        finally:
            os.unlink(path)

    def test_sorted_by_borrower_and_date(self):
        """Rows should be sorted by borrower_id then obs_date ascending."""
        path = _write_temp_csv(VALID_CSV)
        try:
            df = load_dataset(path)
            for borrower, grp in df.groupby("borrower_id"):
                dates = grp["obs_date"].tolist()
                self.assertEqual(dates, sorted(dates),
                                 msg=f"Dates not sorted for borrower {borrower}")
        finally:
            os.unlink(path)


class TestValidateDataset(unittest.TestCase):

    def test_missing_column_raises(self):
        """validate_dataset should raise ValueError for a missing required column."""
        path = _write_temp_csv(MISSING_COL_CSV)
        try:
            df = pd.read_csv(path)
            with self.assertRaises(ValueError):
                validate_dataset(df)
        finally:
            os.unlink(path)

    def test_out_of_range_rating_raises(self):
        """validate_dataset should raise ValueError when ratings are outside [1, 5]."""
        path = _write_temp_csv(BAD_RATING_CSV)
        try:
            # We parse manually to bypass the raise inside load_dataset
            df = pd.read_csv(path)
            df["obs_date"] = pd.to_datetime(df["obs_date"])
            df["rating"] = pd.to_numeric(df["rating"])
            df["gamma"] = pd.to_numeric(df["gamma"])
            df["loan_amount"] = pd.to_numeric(df["loan_amount"])
            df["default_flag"] = 0
            with self.assertRaises(ValueError):
                validate_dataset(df)
        finally:
            os.unlink(path)

    def test_valid_data_does_not_raise(self):
        """validate_dataset should not raise for a well-formed DataFrame."""
        path = _write_temp_csv(VALID_CSV)
        try:
            df = load_dataset(path)
            # Should complete without exception
            validate_dataset(df)
        finally:
            os.unlink(path)


class TestDatasetSummary(unittest.TestCase):

    def test_summary_returns_dict(self):
        """dataset_summary should return a dict."""
        path = _write_temp_csv(VALID_CSV)
        try:
            df = load_dataset(path)
            summary = dataset_summary(df)
            self.assertIsInstance(summary, dict)
        finally:
            os.unlink(path)

    def test_summary_contains_expected_keys(self):
        """dataset_summary dict should have the key 'Total observations'."""
        path = _write_temp_csv(VALID_CSV)
        try:
            df = load_dataset(path)
            summary = dataset_summary(df)
            self.assertIn("Total observations", summary)
            self.assertIn("Unique borrowers", summary)
        finally:
            os.unlink(path)

    def test_summary_counts_match(self):
        """Total observations should equal the number of rows loaded."""
        path = _write_temp_csv(VALID_CSV)
        try:
            df = load_dataset(path)
            summary = dataset_summary(df)
            self.assertEqual(summary["Total observations"], 4)
            self.assertEqual(summary["Unique borrowers"], 2)
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
