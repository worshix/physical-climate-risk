import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBorrowerSession } from "@/lib/auth";
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

/**
 * POST /api/borrower/field/[fieldId]/analyse
 *
 * Authenticated farmer triggers a satellite + SPEI analysis of their own field.
 * Fetches NDVI, weather, and real SPEI-3 data for the field polygon, computes
 * the agricultural score and γ (drought index), then persists the Analysis record
 * and optionally recomputes ECL if the farmer has an active loan.
 */
export async function POST(_req: Request, { params }: Params) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { fieldId } = await params;

    // Ensure the field belongs to this farmer
    const field = await prisma.field.findUnique({
      where: { id: fieldId, borrowerId: session.userId },
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

    // ── Satellite + SPEI data ───────────────────────────────────────────
    const polygon = JSON.parse(field.polygon);
    const satData = await getSatelliteData(polygon);

    // ── Derived scores ──────────────────────────────────────────────────
    const gamma = computeGamma(satData);           // real SPEI-3 or proxy
    const regimeWeight = computeRegimeWeight(gamma);
    const agriculturalScore = computeAgriculturalScore(satData);
    const healthStatus = deriveHealthStatus(agriculturalScore);
    const ndviTrend = deriveNdviTrend(satData.ndvi_trend);
    const waterStressRisk = satData.total_rainfall_mm < 20 || satData.mean_ndvi < 0.2;
    const diseaseRisk =
      satData.ndvi_variance > 0.08 ||
      (satData.avg_temperature_c > 32 && satData.total_rainfall_mm > 60);

    const recommendations = getRecommendations({
      meanNDVI: satData.mean_ndvi,
      trend: ndviTrend,
      avgTemp: satData.avg_temperature_c,
      totalRainfall: satData.total_rainfall_mm,
      ndviVariance: satData.ndvi_variance,
      gamma,
    });

    // ── Persist Analysis ────────────────────────────────────────────────
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

    // ── ECL recompute (if active loan exists) ───────────────────────────
    let eclForecast = null;
    const activeLoan = field.borrower.loans[0];
    if (activeLoan) {
      const eclResult = await computeECL(activeLoan.id, gamma);
      eclForecast = await saveECLForecast(activeLoan.id, eclResult);

      let stage = "STAGE_1";
      if (regimeWeight >= 0.6 || activeLoan.currentRating <= 2) stage = "STAGE_3";
      else if (regimeWeight >= 0.35 || activeLoan.currentRating === 3) stage = "STAGE_2";

      await prisma.loan.update({
        where: { id: activeLoan.id },
        data: { stage },
      });
    }

    return NextResponse.json(
      {
        analysis,
        eclForecast,
        spei: {
          value: gamma,
          label: satData.spei_label,
          source: satData.spei_result ? "SPEI-3 (Open-Meteo archive + Thornthwaite PET)" : "proxy",
          monthsUsed: satData.spei_result?.monthsUsed ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Borrower analyse field error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
