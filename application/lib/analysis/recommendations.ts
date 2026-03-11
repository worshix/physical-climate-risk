export type AnalysisInput = {
  meanNDVI: number;
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  avgTemp: number;
  totalRainfall: number;
  ndviVariance?: number;
};

export function getRecommendations(input: AnalysisInput): string[] {
  const recs: string[] = [];

  // Rule 1 – Water Stress
  if (input.meanNDVI < 0.45 && input.totalRainfall < 10) {
    recs.push("Low vegetation health combined with limited rainfall indicates possible water stress. Irrigation is recommended.");
  }

  // Rule 2 – Monitoring
  if (input.trend === "DECLINING" && input.meanNDVI >= 0.45 && input.meanNDVI <= 0.6) {
    recs.push("Crop health is declining. Monitor the field closely for early signs of stress or disease.");
  }

  // Rule 3 – Stable
  if (input.meanNDVI > 0.6 && (input.trend === "STABLE" || input.trend === "IMPROVING")) {
    recs.push("Crop health is stable. No immediate action is required regarding fertilizers or growth regulators.");
  }

  // Rule 4 – Disease Risk
  if ((input.ndviVariance || 0) > 0.05 && input.avgTemp > 25) {
    recs.push("Irregular vegetation patterns detected. Inspect the field for possible disease or pest activity.");
  }

  if (recs.length === 0) {
    recs.push("Continue routine field observations.");
  }

  return recs;
}
