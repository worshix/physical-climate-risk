import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

type Params = { params: Promise<{ loanId: string }> };

// POST /api/admin/loans/[loanId]/observations — add a quarterly rating observation
export async function POST(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { loanId } = await params;
    const { obsPeriod, obsDate, rating, defaultFlag, gamma, loanAmount } = await req.json();

    if (!obsPeriod || !obsDate || !rating || gamma === undefined || !loanAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

    const observation = await prisma.ratingObservation.create({
      data: {
        loanId,
        obsPeriod,
        obsDate: new Date(obsDate),
        rating,
        defaultFlag: defaultFlag ?? false,
        gamma,
        loanAmount,
      },
    });

    // Keep loan's currentRating and loanAmount in sync with latest observation
    await prisma.loan.update({
      where: { id: loanId },
      data: {
        currentRating: rating,
        loanAmount,
        status: defaultFlag ? "DEFAULT" : "ACTIVE",
      },
    });

    return NextResponse.json(observation, { status: 201 });
  } catch (error) {
    console.error("Add observation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
