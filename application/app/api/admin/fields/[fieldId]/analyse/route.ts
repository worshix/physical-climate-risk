import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { getSatelliteData } from "@/lib/gee/satellite";
import {
  computeAgriculturalScore,
  computeGamma,
  computeRegimeWeight,
  deriveHealthStatus,
  deriveNdviTrend,
} from "@/lib/analysis/scoring";
import { getRecommendations } from "@/lib/analysis/recommendations";
import { computeECL, saveECLForecast } from "@/lib/ecl/engine";

type Params = { params: Promise<{ fieldId: string }> };

// POST /api/admin/fields/[fieldId]/analyse
export async function POST(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { fieldId } = await params;

    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: {
        borrower: {
          include: {
            loans: {
              where: { status: { not: "REPAID" } },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });

    // ── Satellite + weather data ───────────────────────────────────────────
    const polygon = JSON.parse(field.polygon);
    const satData = await getSatelliteData(polygon);

    // ── Derived scores ─────────────────────────────────────────────────────
    const gamma = computeGamma(satData);
    const regimeWeight = computeRegimeWeight(gamma);
    const agriculturalScore = computeAgriculturalScore(satData);
    const healthStatus = deriveHealthStatus(agriculturalScore);
    const ndviTrend = deriveNdviTrend(satData.ndvi_trend);
    const waterStressRisk = satData.total_rainfall_mm < 20 || satData.mean_ndvi < 0.2;
    const diseaseRisk = satData.ndvi_variance > 0.08 || (satData.avg_temperature_c > 32 && satData.total_rainfall_mm > 60);

    const recommendations = getRecommendations({
      meanNDVI: satData.mean_ndvi,
      trend: ndviTrend,
      avgTemp: satData.avg_temperature_c,
      totalRainfall: satData.total_rainfall_mm,
      ndviVariance: satData.ndvi_variance,
    });

    // ── Persist Analysis ───────────────────────────────────────────────────
    const analysis = await prisma.analysis.create({
      data: {
        fieldId,
        meanNDVI: satData.mean_ndvi,
        ndviTrend,
        healthStatus,
        avgTemperature: satData.avg_temperature_c,
        totalRainfall: satData.total_rainfall_mm,
        waterStressRisk,
        diseaseRisk,
        gamma,
        regimeWeight,
        agriculturalScore,
        rawData: JSON.stringify(satData),
        recommendations: JSON.stringify(recommendations),
      },
    });

    // ── ECL computation (if borrower has an active loan) ───────────────────
    let eclForecast = null;
    const activeLoan = field.borrower.loans[0];
    if (activeLoan) {
      const eclResult = await computeECL(activeLoan.id, gamma);
      eclForecast = await saveECLForecast(activeLoan.id, eclResult);

      // Keep loan stage in sync with regime weight
      let stage = "STAGE_1";
      if (regimeWeight >= 0.6 || activeLoan.currentRating <= 2) stage = "STAGE_3";
      else if (regimeWeight >= 0.35 || activeLoan.currentRating === 3) stage = "STAGE_2";

      await prisma.loan.update({
        where: { id: activeLoan.id },
        data: { stage },
      });
    }

    return NextResponse.json({ analysis, eclForecast }, { status: 201 });
  } catch (error) {
    console.error("Analyse field error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
