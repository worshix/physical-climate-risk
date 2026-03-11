# Tobacco Crop Health Model

This folder contains the machine learning pipelines for the Tobacco Assessment prototype.

## Overview
We use a **Logistic Regression** classifier to determine the overall health of tobacco fields based on satellite (NDVI) and weather data. Python is used exclusively for training and evaluation; the final model is exported to JSON for direct consumption by the Next.js application.

## Folder Structure
- `data/raw/`: Contains `dataset.csv` with historical NDVI and weather samples.
- `src/`: Core Python source code.
  - `config.py`: Path and feature configurations.
  - `train_health_model.py`: Training script with evaluation.
  - `export_model.py`: Exports the model weights to JSON.
- `models/`: Exported model files.
  - `crop_health_model.json`: Model coefficients and classes.
  - `thresholds.json`: Rule-based thresholds for risk detection.
- `reports/`: Training evaluation reports and visualizations.

## How to Train & Export
1. Ensure `uv` is installed.
2. Install dependencies: `uv sync`
3. Run training: `uv run python src/train_health_model.py`
4. Export for Web: `uv run python src/export_model.py`

## Features
The model uses the following features:
- `mean_ndvi`: Average vegetation index.
- `ndvi_trend`: Temporal trend of NDVI (improving/declining).
- `ndvi_variance`: Spatial/Temporal variance.
- `avg_temperature_c`: Average temperature.
- `total_rainfall_mm`: Cumulative rainfall.

## Model Consumption
The Next.js app reads the JSON weights in `api/analyse` to provide real-time predictions without a Python runtime, ensuring a lightweight and easy-to-deploy architecture.
