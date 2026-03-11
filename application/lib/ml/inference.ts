import modelData from "../../models/models/crop_health_model.json";

export type HealthStatus = "HEALTHY" | "HIGH_STRESS" | "MODERATE_STRESS";

export interface MLFeatures {
  mean_ndvi: number;
  ndvi_trend: number;
  ndvi_variance: number;
  avg_temperature_c: number;
  total_rainfall_mm: number;
}

/**
 * Performs Logistic Regression inference using the exported weights.
 * Calculation: z = sum(w * x) + b for each class.
 */
export function predictCropHealth(features: MLFeatures): HealthStatus {
  const { coefficients, intercept, classes } = modelData;
  const featureValues = [
    features.mean_ndvi,
    features.ndvi_trend,
    features.ndvi_variance,
    features.avg_temperature_c,
    features.total_rainfall_mm
  ];

  let maxZ = -Infinity;
  let predictedClassIndex = 0;

  // Calculate scores for each class
  for (let j = 0; j < coefficients.length; j++) {
    let z = intercept[j];
    for (let i = 0; i < featureValues.length; i++) {
      z += coefficients[j][i] * featureValues[i];
    }

    if (z > maxZ) {
      maxZ = z;
      predictedClassIndex = j;
    }
  }

  return classes[predictedClassIndex] as HealthStatus;
}
