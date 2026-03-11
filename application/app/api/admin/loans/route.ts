import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

// POST /api/admin/loans — create a new loan for a borrower
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { borrowerId, loanRef, currentRating, loanAmount, disbursementDate, stage } =
      await req.json();

    if (!borrowerId || !loanRef || !currentRating || !loanAmount || !disbursementDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (currentRating < 1 || currentRating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    const borrower = await prisma.user.findUnique({
      where: { id: borrowerId, role: "BORROWER" },
    });
    if (!borrower) {
      return NextResponse.json({ error: "Borrower not found" }, { status: 404 });
    }

    const loan = await prisma.loan.create({
      data: {
        borrowerId,
        loanRef,
        currentRating,
        loanAmount,
        disbursementDate: new Date(disbursementDate),
        stage: stage ?? "STAGE_1",
        status: "ACTIVE",
      },
    });

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error("Create loan error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
