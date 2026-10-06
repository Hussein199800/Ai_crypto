import { describe, expect, it } from "vitest";
import { canCreatePrivateReport, canViewReport, decideAccess, isProtectedPath, safeCallbackUrl } from "@/lib/auth/policy";

describe("حماية الصفحات الخاصة", () => {
  it("يحدد المسارات الخاصة", () => {
    expect(isProtectedPath("/alerts")).toBe(true);
    expect(isProtectedPath("/alerts/x")).toBe(true);
    expect(isProtectedPath("/api/alerts")).toBe(true);
    expect(isProtectedPath("/alertsx")).toBe(false);
    expect(isProtectedPath("/reports")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });

  it("الزائر يُحوَّل لتسجيل الدخول مع مسار العودة", () => {
    expect(decideAccess("/alerts", false, "?a=1")).toEqual({ action: "redirect", location: "/login?callbackUrl=%2Falerts%3Fa%3D1" });
  });

  it("مسارات الـ API الخاصة تعيد 401 للزائر", () => {
    expect(decideAccess("/api/alerts", false)).toEqual({ action: "unauthorized" });
  });

  it("المستخدم المسجل يمر", () => {
    expect(decideAccess("/alerts", true)).toEqual({ action: "next" });
    expect(decideAccess("/reports", false)).toEqual({ action: "next" });
  });

  it("يمنع إعادة التوجيه إلى مواقع خارجية بعد الدخول", () => {
    expect(safeCallbackUrl("https://evil.com")).toBe("/");
    expect(safeCallbackUrl("//evil.com")).toBe("/");
    expect(safeCallbackUrl("/\\evil.com")).toBe("/");
    expect(safeCallbackUrl("/watchlist")).toBe("/watchlist");
    expect(safeCallbackUrl(null)).toBe("/");
  });
});

describe("صلاحيات المستخدم على التقارير", () => {
  const owner = { id: "u1", role: "USER" as const };
  const other = { id: "u2", role: "USER" as const };
  const admin = { id: "a1", role: "ADMIN" as const };

  it("التقارير العامة متاحة للجميع", () => {
    expect(canViewReport({ userId: "u1", isPublic: true }, null)).toBe(true);
  });

  it("التقارير الخاصة لمالكها فقط (والمشرف)", () => {
    const priv = { userId: "u1", isPublic: false };
    expect(canViewReport(priv, owner)).toBe(true);
    expect(canViewReport(priv, other)).toBe(false);
    expect(canViewReport(priv, null)).toBe(false);
    expect(canViewReport(priv, admin)).toBe(true);
    expect(canViewReport({ userId: null, isPublic: false }, other)).toBe(false);
  });

  it("إنشاء تقرير خاص يتطلب حسابًا", () => {
    expect(canCreatePrivateReport(null)).toBe(false);
    expect(canCreatePrivateReport(owner)).toBe(true);
  });
});
