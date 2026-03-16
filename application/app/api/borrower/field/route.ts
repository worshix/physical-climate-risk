import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBorrowerSession } from "@/lib/auth";
import {
  calculatePolygonArea,
  getPolygonCentroid,
  reverseGeocode,
  extractCoordinates,
} from "@/lib/geo/utils";

/**
 * POST /api/borrower/field
 *
 * Authenticated farmer creates their own field polygon.
 * The borrowerId is taken from the session — farmers can only create fields for themselves.
 */
export async function POST(req: Request) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { name, cropType, polygon } = await req.json() as {
      name?: string;
      cropType?: string;
      polygon?: unknown;
    };

    if (!name?.trim() || !cropType || !polygon) {
      return NextResponse.json({ error: "Name, crop type and field boundary are required." }, { status: 400 });
    }

    const borrower = await prisma.user.findUnique({
      where: { id: session.userId, role: "BORROWER" },
    });
    if (!borrower) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const polygonStr = typeof polygon === "string" ? polygon : JSON.stringify(polygon);
    const coordinates = extractCoordinates(JSON.parse(polygonStr));

    let area: number | null = null;
    let location: string | null = null;
    const district: string | null = borrower.district ?? null;

    if (coordinates) {
      area = calculatePolygonArea(coordinates);
      const centroid = getPolygonCentroid(coordinates);
      try {
        location = await reverseGeocode(centroid.lat, centroid.lng) ?? null;
      } catch {
        // non-fatal
      }
    }

    const field = await prisma.field.create({
      data: {
        borrowerId: session.userId,
        name: name.trim(),
        cropType,
        polygon: polygonStr,
        area,
        location,
        district,
      },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    console.error("Borrower create field error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * GET /api/borrower/field
 *
 * Returns the authenticated farmer's fields (with latest analysis).
 */
export async function GET() {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fields = await prisma.field.findMany({
    where: { borrowerId: session.userId },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(fields);
}
