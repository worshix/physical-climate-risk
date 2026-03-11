import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export async function POST() {
  // Public self-registration is disabled.
  // Borrower accounts are created by the admin via /api/admin/borrowers.
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "Account registration is managed by your credit officer." },
      { status: 403 }
    );
  }
  return NextResponse.json(
    { error: "Use /api/admin/borrowers to create borrower accounts." },
    { status: 400 }
  );
}
