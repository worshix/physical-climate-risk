"""
src/ingestion.py — Data loading and validation.

Responsibilities:
  • Load the raw CSV from disk.
  • Validate that all required columns are present.
  • Parse and sort dates, cast types, flag missing values.
  • Return a clean pandas DataFrame ready for transition extraction.
"""

from __future__ import annotations

import pandas as pd
import sys
import os

# Allow importing from project root when run directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import REQUIRED_COLUMNS, DEFAULT_STATE, N_STATES


def load_dataset(path: str) -> pd.DataFrame:
    """Load the MFI dataset from a CSV file.

    Parameters
    ----------
    path : str
        Absolute or relative path to the CSV file.

    Returns
    -------
    pd.DataFrame
        Cleaned and typed DataFrame.

    Raises
    ------
    FileNotFoundError
        If the path does not exist.
    ValueError
        If required columns are missing.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset not found at: {path}")

    df = pd.read_csv(path, parse_dates=False)

    # Parse obs_date flexibly (handles DD-MM-YY and YYYY-MM-DD)
    df["obs_date"] = pd.to_datetime(df["obs_date"], dayfirst=True, errors="coerce")

    # Cast numeric columns
    df["rating"] = pd.to_numeric(df["rating"], errors="coerce")
    df["gamma"] = pd.to_numeric(df["gamma"], errors="coerce")
    df["loan_amount"] = pd.to_numeric(df["loan_amount"], errors="coerce")
    df["default_flag"] = pd.to_numeric(df["default_flag"], errors="coerce").fillna(0).astype(int)

    # Sort chronologically within each borrower
    df = df.sort_values(["borrower_id", "obs_date"]).reset_index(drop=True)

    validate_dataset(df)
    return df


def validate_dataset(df: pd.DataFrame) -> None:
    """Check that the DataFrame meets the minimum schema requirements.

    Parameters
    ----------
    df : pd.DataFrame
        The loaded dataset.

    Raises
    ------
    ValueError
        If any required column is missing or rating values are out of range.
    """
    # Check required columns
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    # Rating range check
    invalid_ratings = df["rating"].dropna()
    out_of_range = invalid_ratings[~invalid_ratings.isin(range(1, N_STATES + 1))]
    if not out_of_range.empty:
        raise ValueError(
            f"Ratings outside valid range [1, {N_STATES}]: {out_of_range.unique().tolist()}"
        )

    # Warn about missing values (do not raise — caller decides)
    n_missing = df[REQUIRED_COLUMNS].isnull().sum()
    if n_missing.any():
        print(f"[ingestion] Warning — missing values detected:\n{n_missing[n_missing > 0]}")


def dataset_summary(df: pd.DataFrame) -> dict:
    """Compute a brief summary of the loaded dataset.

    Returns a dictionary suitable for display in the Streamlit UI.
    """
    active = df[df["loan_amount"] > 0]
    return {
        "Total observations": len(df),
        "Unique borrowers": df["borrower_id"].nunique(),
        "Unique districts": df["district"].nunique(),
        "Date range": f"{df['obs_date'].min().date()} → {df['obs_date'].max().date()}",
        "Rating states observed": sorted(df["rating"].dropna().unique().astype(int).tolist()),
        "Default observations (Rating 1)": int((df["rating"] == DEFAULT_STATE).sum()),
        "Stress-regime obs (γ < −1.0)": int((df["gamma"] < -1.0).sum()),
        "Normal-regime obs (γ ≥ −1.0)": int((df["gamma"] >= -1.0).sum()),
        "Active loans (balance > 0)": len(active),
        "Mean loan balance (active, $)": round(active["loan_amount"].mean(), 2),
    }
