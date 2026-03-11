import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { calculatePolygonArea, getPolygonCentroid, reverseGeocode, extractCoordinates } from "@/lib/geo/utils";

// POST /api/admin/fields — create a field for a borrower
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { borrowerId, name, cropType, polygon } = await req.json();

    if (!borrowerId || !name || !cropType || !polygon) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const borrower = await prisma.user.findUnique({
      where: { id: borrowerId, role: "BORROWER" },
    });
    if (!borrower) return NextResponse.json({ error: "Borrower not found" }, { status: 404 });

    const polygonStr = typeof polygon === "string" ? polygon : JSON.stringify(polygon);

    // Compute area + reverse geocode
    const coordinates = extractCoordinates(JSON.parse(polygonStr));
    let area: number | null = null;
    let location: string | null = null;
    let district: string | null = borrower.district ?? null;

    if (coordinates) {
      area = calculatePolygonArea(coordinates);
      const centroid = getPolygonCentroid(coordinates);
      try {
        const geocoded = await reverseGeocode(centroid.lat, centroid.lng);
        location = geocoded ?? null;
      } catch {
        // non-fatal
      }
    }

    const field = await prisma.field.create({
      data: {
        borrowerId,
        name,
        cropType,
        polygon: polygonStr,
        area,
        location,
        district,
      },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    console.error("Create field error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
