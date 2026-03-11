import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

type Params = { params: Promise<{ borrowerId: string }> };

// GET /api/admin/borrowers/[borrowerId]
export async function GET(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { borrowerId } = await params;

  const borrower = await prisma.user.findUnique({
    where: { id: borrowerId, role: "BORROWER" },
    include: {
      loans: {
        include: {
          observations: { orderBy: { obsDate: "asc" } },
          eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      },
      fields: {
        include: {
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!borrower) return NextResponse.json({ error: "Borrower not found" }, { status: 404 });

  return NextResponse.json(borrower);
}

// PATCH /api/admin/borrowers/[borrowerId] — update profile
export async function PATCH(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { borrowerId } = await params;
  const { name, phone, nationalId, district, primaryActivity } = await req.json();

  const updated = await prisma.user.update({
    where: { id: borrowerId },
    data: {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(nationalId !== undefined && { nationalId }),
      ...(district !== undefined && { district }),
      ...(primaryActivity !== undefined && { primaryActivity }),
    },
    select: {
      id: true, name: true, email: true, phone: true,
      nationalId: true, district: true, primaryActivity: true,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/borrowers/[borrowerId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { borrowerId } = await params;

  await prisma.user.delete({ where: { id: borrowerId } });

  return NextResponse.json({ success: true });
}
