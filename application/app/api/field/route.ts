import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { calculatePolygonArea, getPolygonCentroid, reverseGeocode, extractCoordinates } from "@/lib/geo/utils";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, polygon } = await req.json();

    if (!name || !polygon) {
      return NextResponse.json({ error: "Missing name or polygon" }, { status: 400 });
    }

    // Extract coordinates and calculate area
    const coordinates = extractCoordinates(polygon);
    let area: number | null = null;
    let location: string | null = null;

    if (coordinates) {
      // Calculate area in hectares
      area = Math.round(calculatePolygonArea(coordinates) * 100) / 100;
      
      // Get centroid and reverse geocode for location
      const centroid = getPolygonCentroid(coordinates);
      location = await reverseGeocode(centroid.lat, centroid.lng);
    }

    const field = await prisma.field.create({
      data: {
        name,
        polygon: JSON.stringify(polygon),
        area,
        location,
        borrowerId: userId,
        cropType: "Unknown",
      },
    });

    return NextResponse.json(field);
  } catch (error) {
    console.error("Field creation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
