export type AnalysisInput = {
  meanNDVI: number;
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  avgTemp: number;
  totalRainfall: number;
  ndviVariance?: number;
  gamma?: number; // SPEI-3 drought index (negative = drier)
};

export function getRecommendations(input: AnalysisInput): string[] {
  const recs: string[] = [];
  const gamma = input.gamma ?? 0;

  // Rule 1 – Severe water stress: both NDVI and rainfall critically low
  if (input.meanNDVI < 0.45 && input.totalRainfall < 10) {
    recs.push(
      "Low vegetation health combined with critically low rainfall indicates severe water stress. Immediate irrigation is strongly recommended."
    );
  }

  // Rule 2 – SPEI moderate drought (gamma < -1.0): persistent regional dryness
  if (gamma < -1.0) {
    recs.push(
      "The drought index for your region indicates moderate to severe drought conditions. Prioritise irrigation and consider water-conservation practices to protect your crop."
    );
  }

  // Rule 3 – SPEI mildly dry (gamma between -1.0 and 0): below-normal moisture trend
  if (gamma >= -1.0 && gamma < 0) {
    recs.push(
      "Conditions are mildly drier than normal. Monitor soil moisture closely and consider supplemental irrigation to prevent crop stress."
    );
  }

  // Rule 4 – Low recent rainfall regardless of SPEI
  if (input.totalRainfall >= 10 && input.totalRainfall < 30 && gamma >= 0) {
    recs.push(
      "Rainfall over the past two weeks has been below optimal. Monitor soil moisture and irrigate if the dry spell continues."
    );
  }

  // Rule 5 – Very low recent rainfall with adequate SPEI (short dry spell)
  if (input.totalRainfall < 10 && input.meanNDVI >= 0.45 && gamma >= 0) {
    recs.push(
      "Rainfall is very low over the past two weeks. Despite currently adequate vegetation, begin irrigation now to avert rapid decline."
    );
  }

  // Rule 6 – Declining health
  if (input.trend === "DECLINING" && input.meanNDVI >= 0.45 && input.meanNDVI <= 0.6) {
    recs.push(
      "Crop health is declining. Monitor the field closely for early signs of stress or disease."
    );
  }

  // Rule 7 – Stable and genuinely healthy: only when SPEI is non-negative and rainfall adequate
  if (
    input.meanNDVI > 0.6 &&
    input.totalRainfall >= 30 &&
    gamma >= 0 &&
    (input.trend === "STABLE" || input.trend === "IMPROVING")
  ) {
    recs.push(
      "Crop health is stable and moisture conditions are adequate. No immediate action is required regarding fertilizers or growth regulators."
    );
  }

  // Rule 8 – Disease / pest risk
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
