import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

// GET /api/admin/loans — list all loans with borrower + latest ECL
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const loans = await prisma.loan.findMany({
    include: {
      borrower: { select: { id: true, name: true, district: true } },
      eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
      _count: { select: { observations: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(loans);
}

// POST /api/admin/loans — create a new loan for a borrower
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { borrowerId, loanRef, loanAmount, currentRating, disbursementDate, stage, status } =
      await req.json();

    if (!borrowerId || !loanRef || !loanAmount || !currentRating || !disbursementDate) {
      return NextResponse.json({ error: "borrowerId, loanRef, loanAmount, currentRating and disbursementDate are required" }, { status: 400 });
    }

    const existing = await prisma.loan.findUnique({ where: { loanRef } });
    if (existing) {
      return NextResponse.json({ error: "Loan reference already exists" }, { status: 400 });
    }

    const loan = await prisma.loan.create({
      data: {
        borrowerId,
        loanRef,
        loanAmount: Number(loanAmount),
        currentRating: Number(currentRating),
        disbursementDate: new Date(disbursementDate),
        stage: stage ?? "STAGE_1",
        status: status ?? "ACTIVE",
      },
    });

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error("Create loan error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
