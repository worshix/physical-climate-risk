import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

type Params = { params: Promise<{ fieldId: string }> };

// GET /api/admin/fields/[fieldId]
export async function GET(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fieldId } = await params;

  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });

  return NextResponse.json(field);
}
