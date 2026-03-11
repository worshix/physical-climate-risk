import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { generateBorrowerReport } from "@/lib/reports/generateBorrowerReport";

type Params = { params: Promise<{ borrowerId: string }> };

// GET /api/admin/borrowers/[borrowerId]/report
export async function GET(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { borrowerId } = await params;
    const report = await generateBorrowerReport(borrowerId);
    return NextResponse.json(report);
  } catch (error: any) {
    if (error?.message?.includes("not found")) {
      return NextResponse.json({ error: "Borrower not found" }, { status: 404 });
    }
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
