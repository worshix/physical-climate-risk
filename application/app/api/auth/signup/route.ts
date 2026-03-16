import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/signup
 *
 * Self-registration for farmers (BORROWER role).
 * Creates a new BORROWER account and sets the session cookie so the user
 * is immediately logged in and redirected to onboarding.
 *
 * Admin accounts are seeded via prisma/seed.ts only — not via this endpoint.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, phone, nationalId, district, primaryActivity } = body as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      nationalId?: string;
      district?: string;
      primaryActivity?: string;
    };

    // ── Validation ────────────────────────────────────────────────────────
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required." },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }
    if (!district) {
      return NextResponse.json({ error: "District is required." }, { status: 400 });
    }
    if (!primaryActivity) {
      return NextResponse.json({ error: "Primary activity is required." }, { status: 400 });
    }

    // ── Duplicate email check ─────────────────────────────────────────────
    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    // ── Create BORROWER account ───────────────────────────────────────────
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role: "BORROWER",
        phone: phone?.trim() || null,
        nationalId: nationalId?.trim() || null,
        district,
        primaryActivity,
      },
    });

    // ── Set session cookies (same as login) ───────────────────────────────
    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    } as const;
    cookieStore.set("userId", user.id, cookieOpts);
    cookieStore.set("userRole", user.role, cookieOpts);

    return NextResponse.json(
      { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
