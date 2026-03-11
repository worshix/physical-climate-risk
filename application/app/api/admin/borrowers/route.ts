import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

// GET /api/admin/borrowers — list all borrowers with their latest loan + ECL
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const borrowers = await prisma.user.findMany({
    where: { role: "BORROWER" },
    include: {
      loans: {
        where: { status: "ACTIVE" },
        include: {
          eclForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(borrowers);
}

// POST /api/admin/borrowers — create a new borrower account
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { name, email, password, phone, nationalId, district, primaryActivity } =
      await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const borrower = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "BORROWER",
        phone: phone ?? null,
        nationalId: nationalId ?? null,
        district: district ?? null,
        primaryActivity: primaryActivity ?? null,
      },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, nationalId: true, district: true, primaryActivity: true,
        createdAt: true,
      },
    });

    return NextResponse.json(borrower, { status: 201 });
  } catch (error) {
    console.error("Create borrower error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
