import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { API_AUTH_PREFIX, AUTH_ROUTES, DASHBOARD_PREFIX, DEFAULT_LOGIN_REDIRECT } from "@/lib/routes";

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isLoggedIn = Boolean(request.auth?.user);
  const isApiAuthRoute = pathname.startsWith(API_AUTH_PREFIX);
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isDashboardRoute = pathname.startsWith(DASHBOARD_PREFIX);

  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, request.nextUrl));
  }

  if (isDashboardRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
