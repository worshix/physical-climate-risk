import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

type Params = { params: Promise<{ loanId: string }> };

// GET /api/admin/loans/[loanId]
export async function GET(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { loanId } = await params;

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: { id: true, name: true, district: true } },
      observations: { orderBy: { obsDate: "asc" } },
      eclForecasts: { orderBy: { computedAt: "desc" }, take: 5 },
    },
  });

  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  return NextResponse.json(loan);
}

// PATCH /api/admin/loans/[loanId] — update rating, amount, stage, status
export async function PATCH(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { loanId } = await params;
  const body = await req.json();

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: {
      ...(body.loanAmount !== undefined && { loanAmount: Number(body.loanAmount) }),
      ...(body.currentRating !== undefined && { currentRating: Number(body.currentRating) }),
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/loans/[loanId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { loanId } = await params;
  await prisma.loan.delete({ where: { id: loanId } });
  return NextResponse.json({ success: true });
}
