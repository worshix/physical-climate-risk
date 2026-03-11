import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { predictCropHealth, MLFeatures } from "@/lib/ml/inference";
import { getRecommendations } from "@/lib/analysis/recommendations";
import { getSatelliteData } from "@/lib/gee/satellite";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fieldId } = body;

    // 1. Fetch field from DB (and verify ownership)
    const field = await prisma.field.findUnique({
      where: { 
        id: fieldId,
        borrowerId: userId,
      },
    });

    if (!field) {
      return NextResponse.json({ error: "Field not found or access denied" }, { status: 404 });
    }

    // 2. Parse polygon and get REAL satellite data
    let polygon;
    try {
      polygon = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon;
    } catch (e) {
      return NextResponse.json({ error: "Invalid polygon data" }, { status: 400 });
    }

    // Fetch real satellite and weather data
    const satelliteData = await getSatelliteData(polygon);

    const features: MLFeatures = {
      mean_ndvi: satelliteData.mean_ndvi,
      ndvi_trend: satelliteData.ndvi_trend,
      ndvi_variance: satelliteData.ndvi_variance,
      avg_temperature_c: satelliteData.avg_temperature_c,
      total_rainfall_mm: satelliteData.total_rainfall_mm,
    };

    // 3. Run Inference
    const healthStatus = predictCropHealth(features);

    // 4. Get Recommendations
    const recommendations = getRecommendations({
      meanNDVI: features.mean_ndvi,
      trend: features.ndvi_trend > 0 ? "IMPROVING" : features.ndvi_trend < -0.01 ? "DECLINING" : "STABLE",
      avgTemp: features.avg_temperature_c,
      totalRainfall: features.total_rainfall_mm,
      ndviVariance: features.ndvi_variance,
    });

    // 5. Save Analysis to DB
    const analysis = await prisma.analysis.create({
      data: {
        fieldId: fieldId,
        healthStatus: healthStatus,
        meanNDVI: features.mean_ndvi,
        ndviTrend: features.ndvi_trend > 0 ? "IMPROVING" : features.ndvi_trend < -0.01 ? "DECLINING" : "STABLE",
        avgTemperature: features.avg_temperature_c,
        totalRainfall: features.total_rainfall_mm,
        waterStressRisk: features.total_rainfall_mm < 10 && features.mean_ndvi < 0.45,
        diseaseRisk: features.ndvi_variance > 0.05,
        rawData: JSON.stringify({
            temp: features.avg_temperature_c,
            rain: features.total_rainfall_mm,
            variance: features.ndvi_variance,
            source: satelliteData.data_source,
            region_type: satelliteData.region_type,
        }),
        recommendations: JSON.stringify(recommendations),
      }
    });

    return NextResponse.json({
        id: analysis.id,
        ...features,
        healthStatus,
        recommendations,
        dataSource: satelliteData.data_source,
        regionType: satelliteData.region_type,
    });
  } catch (error) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ error: "Failed to run analysis" }, { status: 500 });
  }
}
