import json
import joblib
import numpy as np
from config import MODEL_DIR, FEATURES, MODEL_EXPORT_PATH, THRESHOLDS_PATH

def export_model():
    model_path = MODEL_DIR / "crop_health_model.joblib"
    if not model_path.exists():
        print("Model file not found. Please train the model first.")
        return

    print(f"Loading model from {model_path}...")
    model = joblib.load(model_path)

    # For Logistic Regression, we export coefficients and intercept
    model_data = {
        "model_type": "LogisticRegression",
        "features": FEATURES,
        "classes": model.classes_.tolist(),
        "coefficients": model.coef_.tolist(),
        "intercept": model.intercept_.tolist()
    }

    with open(MODEL_EXPORT_PATH, "w") as f:
        json.dump(model_data, f, indent=2)
    
    print(f"Model exported to {MODEL_EXPORT_PATH}")

    # Export Thresholds as well (as defined in MODELS.md)
    thresholds = {
        "ndvi": {
            "healthy": 0.6,
            "moderate": 0.45
        },
        "rainfall": {
            "low": 20
        },
        "temperature": {
            "high": 30
        }
    }

    with open(THRESHOLDS_PATH, "w") as f:
        json.dump(thresholds, f, indent=2)
    
    print(f"Thresholds exported to {THRESHOLDS_PATH}")

if __name__ == "__main__":
    export_model()
