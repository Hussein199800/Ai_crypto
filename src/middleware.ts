import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { decideAccess, isProtectedPath } from "@/lib/auth/policy";

/** حماية الصفحات والمسارات الخاصة: تحويل لصفحة الدخول أو 401 لمسارات الـ API */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const decision = decideAccess(pathname, Boolean(token), search);
  if (decision.action === "redirect") return NextResponse.redirect(new URL(decision.location, req.url));
  if (decision.action === "unauthorized") return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/alerts/:path*", "/account/:path*", "/api/alerts/:path*", "/api/account/:path*"],
};
