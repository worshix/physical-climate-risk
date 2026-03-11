import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // This is a placeholder for Google Earth Engine integration
  return NextResponse.json({ 
    message: "GEE endpoint active",
    note: "This would normally handle polygon-to-satellite-data conversion"
  });
}
