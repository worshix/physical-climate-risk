export type AnalysisInput = {
  meanNDVI: number;
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  avgTemp: number;
  totalRainfall: number;
  ndviVariance?: number;
};

export function getRecommendations(input: AnalysisInput): string[] {
  const recs: string[] = [];

  // Rule 1 – Severe water stress
  if (input.meanNDVI < 0.45 && input.totalRainfall < 10) {
    recs.push(
      "Low vegetation health combined with critically low rainfall indicates severe water stress. Immediate irrigation is strongly recommended."
    );
  }

  // Rule 2 – Mild dryness: low rainfall even if NDVI is still adequate
  if (input.totalRainfall >= 10 && input.totalRainfall < 30) {
    recs.push(
      "Rainfall levels are below optimal. Monitor soil moisture closely and consider supplemental irrigation to prevent crop stress."
    );
  }

  // Rule 3 – Rainfall very low but NDVI still holding (early stress)
  if (input.totalRainfall < 10 && input.meanNDVI >= 0.45) {
    recs.push(
      "Rainfall is critically low. Despite currently adequate vegetation cover, begin irrigation now to avert rapid decline."
    );
  }

  // Rule 4 – Declining health
  if (input.trend === "DECLINING" && input.meanNDVI >= 0.45 && input.meanNDVI <= 0.6) {
    recs.push(
      "Crop health is declining. Monitor the field closely for early signs of stress or disease."
    );
  }

  // Rule 5 – Stable and well-watered: only flag as no-action when rainfall is also sufficient
  if (
    input.meanNDVI > 0.6 &&
    input.totalRainfall >= 30 &&
    (input.trend === "STABLE" || input.trend === "IMPROVING")
  ) {
    recs.push(
      "Crop health is stable and moisture conditions are adequate. No immediate action is required regarding fertilizers or growth regulators."
    );
  }

  // Rule 6 – Disease / pest risk
  if ((input.ndviVariance || 0) > 0.05 && input.avgTemp > 25) {
    recs.push(
      "Irregular vegetation patterns detected. Inspect the field for possible disease or pest activity."
    );
  }

  if (recs.length === 0) {
    recs.push("Continue routine field observations.");
  }

  return recs;
}
