/**
 * سياسات الوصول — دوال نقية قابلة للاختبار تُستخدم في الوسيط (middleware) ومسارات الـ API.
 */

/** صفحات تتطلب تسجيل الدخول */
export const PROTECTED_PAGE_PREFIXES = ["/alerts", "/account"];
/** مسارات API تتطلب تسجيل الدخول دائمًا */
export const PROTECTED_API_PREFIXES = ["/api/alerts", "/api/account"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return [...PROTECTED_PAGE_PREFIXES, ...PROTECTED_API_PREFIXES].some((p) => matches(pathname, p));
}

export type AccessDecision = { action: "next" } | { action: "redirect"; location: string } | { action: "unauthorized" };

/** قرار الوصول للوسيط: صفحات ← تحويل لتسجيل الدخول، API ← 401 */
export function decideAccess(pathname: string, isAuthenticated: boolean, search = ""): AccessDecision {
  if (!isProtectedPath(pathname) || isAuthenticated) return { action: "next" };
  if (pathname.startsWith("/api/")) return { action: "unauthorized" };
  const callbackUrl = encodeURIComponent(`${pathname}${search}`);
  return { action: "redirect", location: `/login?callbackUrl=${callbackUrl}` };
}

export interface Viewer {
  id: string;
  role: "USER" | "ADMIN";
}

export interface ReportAccessInfo {
  userId: string | null;
  isPublic: boolean;
}

/** التقارير العامة متاحة للجميع، والخاصة لمالكها أو للمشرف فقط */
export function canViewReport(report: ReportAccessInfo, viewer: Viewer | null): boolean {
  if (report.isPublic) return true;
  if (!viewer) return false;
  return viewer.role === "ADMIN" || (report.userId !== null && report.userId === viewer.id);
}

/** التقارير الخاصة تتطلب حسابًا */
export function canCreatePrivateReport(viewer: Viewer | null): boolean {
  return viewer !== null;
}

/** يمنع فتح روابط إعادة التوجيه الخارجية بعد تسجيل الدخول */
export function safeCallbackUrl(url: string | null | undefined): string {
  if (!url) return "/";
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return "/";
  return url;
}
