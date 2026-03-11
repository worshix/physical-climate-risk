import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_PATH = DATA_DIR / "raw" / "dataset.csv"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODEL_DIR = BASE_DIR / "models"
REPORT_DIR = BASE_DIR / "reports"

# Ensure directories exist
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

# Feature Configuration
FEATURES = [
    "mean_ndvi",
    "ndvi_trend",
    "ndvi_variance",
    "avg_temperature_c",
    "total_rainfall_mm"
]
TARGET = "crop_health_label"

# Model Export Path
MODEL_EXPORT_PATH = MODEL_DIR / "crop_health_model.json"
THRESHOLDS_PATH = MODEL_DIR / "thresholds.json"
