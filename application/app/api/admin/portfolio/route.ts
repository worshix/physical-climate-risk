import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

// GET /api/admin/portfolio — aggregate portfolio ECL stats
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const loans = await prisma.loan.findMany({
    where: { status: { not: "REPAID" } },
    include: {
      borrower: { select: { id: true, name: true, district: true } },
      eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });

  const activeLoans = loans.filter((l) => l.status === "ACTIVE");
  const defaultLoans = loans.filter((l) => l.status === "DEFAULT");

  // Totals
  const totalEAD = activeLoans.reduce((s, l) => s + l.loanAmount, 0);
  const totalECL1Year = activeLoans.reduce((s, l) => s + (l.eclForecasts[0]?.ecl1Year ?? 0), 0);
  const totalECL5Year = activeLoans.reduce((s, l) => s + (l.eclForecasts[0]?.ecl5Year ?? 0), 0);
  const totalECLExpected = activeLoans.reduce((s, l) => s + (l.eclForecasts[0]?.eclExpected ?? 0), 0);
  const provisioningRate = totalEAD > 0 ? (totalECL1Year / totalEAD) * 100 : 0;

  // Scenario ECL totals
  const totalECLBaseline        = activeLoans.reduce((s, l) => s + (l.eclForecasts[0]?.eclBaseline ?? 0), 0);
  const totalECLModerateDrought = activeLoans.reduce((s, l) => s + (l.eclForecasts[0]?.eclModerateDrought ?? 0), 0);
  const totalECLSevereDrought   = activeLoans.reduce((s, l) => s + (l.eclForecasts[0]?.eclSevereDrought ?? 0), 0);
  const totalECLWetRecovery     = activeLoans.reduce((s, l) => s + (l.eclForecasts[0]?.eclWetRecovery ?? 0), 0);

  // Rating distribution (active loans only)
  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const l of activeLoans) ratingDist[l.currentRating] = (ratingDist[l.currentRating] ?? 0) + 1;

  // Regime breakdown
  let normalCount = 0, stressCount = 0, noECLCount = 0;
  for (const l of activeLoans) {
    const ecl = l.eclForecasts[0];
    if (!ecl) { noECLCount++; continue; }
    if (ecl.regimeWeight >= 0.4) stressCount++;
    else normalCount++;
  }

  // Per-loan rows
  const loanRows = activeLoans.map((l) => {
    const ecl = l.eclForecasts[0] ?? null;
    return {
      loanId: l.id,
      loanRef: l.loanRef,
      borrowerName: l.borrower.name,
      district: l.borrower.district ?? "—",
      rating: l.currentRating,
      stage: l.stage,
      ead: l.loanAmount,
      gamma: ecl?.currentGamma ?? null,
      omega: ecl?.regimeWeight ?? null,
      pd1Q: ecl?.onePeriodPD ?? null,
      ecl1Year: ecl?.ecl1Year ?? null,
      eclExpected: ecl?.eclExpected ?? null,
    };
  });

  return NextResponse.json({
    summary: {
      activeLoanCount: activeLoans.length,
      defaultCount: defaultLoans.length,
      totalEAD,
      totalECL1Year,
      totalECL5Year,
      totalECLExpected,
      provisioningRate,
    },
    scenarios: {
      baseline:        { ecl1Year: totalECLBaseline,        prob: 0.55 },
      moderateDrought: { ecl1Year: totalECLModerateDrought, prob: 0.25 },
      severeDrought:   { ecl1Year: totalECLSevereDrought,   prob: 0.12 },
      wetRecovery:     { ecl1Year: totalECLWetRecovery,     prob: 0.08 },
      expected:        { ecl1Year: totalECLExpected },
    },
    ratingDistribution: ratingDist,
    regimeBreakdown: {
      normal: normalCount,
      stress: stressCount,
      noData: noECLCount,
      total:  activeLoans.length,
    },
    loanRows,
  });
}
