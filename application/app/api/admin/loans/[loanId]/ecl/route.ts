import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { computeECL, saveECLForecast } from "@/lib/ecl/engine";

type Params = { params: Promise<{ loanId: string }> };

// POST /api/admin/loans/[loanId]/ecl
// Body: { gamma?: number }
// If gamma is not provided, uses the borrower's latest satellite analysis gamma.
// Falls back to historical average (−0.73) if no analysis exists.
export async function POST(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { loanId } = await params;

  let gamma: number;

  const body: { gamma?: number } = await req.json().catch(() => ({}));

  if (body.gamma !== undefined && !isNaN(Number(body.gamma))) {
    gamma = Number(body.gamma);
  } else {
    // Resolve gamma from borrower's latest field analysis
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: {
          include: {
            fields: {
              include: {
                analyses: { orderBy: { createdAt: "desc" }, take: 1 },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

    const latestGamma = loan.borrower.fields[0]?.analyses[0]?.gamma;
    gamma = latestGamma ?? -0.73; // fallback to baseline historical average
  }

  try {
    const result = await computeECL(loanId, gamma);
    const forecast = await saveECLForecast(loanId, result);
    return NextResponse.json({ forecast, eclResult: result });
  } catch (error) {
    console.error("ECL computation error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
