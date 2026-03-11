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
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/field/:path*", "/auth/:path*", "/api/field/:path*", "/api/analyse/:path*"],
};
