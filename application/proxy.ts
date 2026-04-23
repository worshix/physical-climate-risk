import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
  const userId = request.cookies.get("userId")?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");
  const isPublicPage = request.nextUrl.pathname === "/";

  if (!userId && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (userId && isAuthPage) {
    const userRole = request.cookies.get("userRole")?.value;
    const dest = userRole === "ADMIN" ? "/admin/dashboard" : "/borrower/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/borrower/:path*", "/auth/:path*", "/api/admin/:path*", "/api/borrower/:path*"],
};
