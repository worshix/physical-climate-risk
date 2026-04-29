import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

type Params = { params: Promise<{ loanId: string }> };

// GET /api/admin/loans/[loanId]/observations
export async function GET(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { loanId } = await params;
  const observations = await prisma.ratingObservation.findMany({
    where: { loanId },
    orderBy: { obsDate: "asc" },
  });

  return NextResponse.json(observations);
}

// POST /api/admin/loans/[loanId]/observations
export async function POST(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { loanId } = await params;

  try {
    const { obsPeriod, obsDate, rating, defaultFlag, gamma, loanAmount } = await req.json();

    if (!obsPeriod || !obsDate || rating === undefined || gamma === undefined || !loanAmount) {
      return NextResponse.json(
        { error: "obsPeriod, obsDate, rating, gamma and loanAmount are required" },
        { status: 400 }
      );
    }

    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

    const obs = await prisma.ratingObservation.create({
      data: {
        loanId,
        obsPeriod,
        obsDate: new Date(obsDate),
        rating: Number(rating),
        defaultFlag: Boolean(defaultFlag),
        gamma: Number(gamma),
        loanAmount: Number(loanAmount),
      },
    });

    return NextResponse.json(obs, { status: 201 });
  } catch (error) {
    console.error("Add observation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
