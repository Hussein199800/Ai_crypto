import { describe, expect, it } from "vitest";
import { generateReportSchema, passwordSchema, registerSchema, reportsQuerySchema, symbolSchema, alertCreateSchema, reportIdSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/security/sanitize";
import { redact } from "@/lib/logger";

describe("التحقق من المدخلات", () => {
  it("يطبّع الرموز المدعومة", () => {
    expect(symbolSchema.parse("btc")).toBe("BTC");
    expect(symbolSchema.parse("eth/btc")).toBe("ETHBTC");
    expect(symbolSchema.parse("BTC.D")).toBe("BTC.D");
    expect(symbolSchema.parse("usdt.d")).toBe("USDT.D");
  });

  it("يرفض الرموز غير المدعومة أو الخطرة", () => {
    expect(symbolSchema.safeParse("FAKE").success).toBe(false);
    expect(symbolSchema.safeParse("<script>").success).toBe(false);
    expect(symbolSchema.safeParse("BTC'; DROP TABLE").success).toBe(false);
    expect(symbolSchema.safeParse("").success).toBe(false);
  });

  it("رسائل الخطأ بالعربية", () => {
    const r = symbolSchema.safeParse("FAKE");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("الرمز غير مدعوم");
    const q = reportsQuerySchema.safeParse({ sort: "bogus" });
    if (!q.success) expect(q.error.issues[0].message).toMatch(/قيمة غير مسموحة/);
  });

  it("قيم افتراضية لطلب إنشاء التقرير", () => {
    expect(generateReportSchema.parse({ symbol: "sol" })).toEqual({ symbol: "SOL", horizon: "MEDIUM", visibility: "public" });
    expect(generateReportSchema.safeParse({ symbol: "SOL", horizon: "FOREVER" }).success).toBe(false);
  });

  it("يحد من حجم الصفحات في الاستعلام", () => {
    expect(reportsQuerySchema.safeParse({ pageSize: "1000" }).success).toBe(false);
    expect(reportsQuerySchema.parse({}).sort).toBe("newest");
  });

  it("يتحقق من معرّفات التقارير", () => {
    expect(reportIdSchema.safeParse("cmuwjfqvm00027dp5ac3f8uwf").success).toBe(true);
    expect(reportIdSchema.safeParse("1 OR 1=1").success).toBe(false);
  });

  it("فترة تهدئة التنبيه لها حد أدنى", () => {
    expect(alertCreateSchema.safeParse({ symbol: "BTC", type: "PRICE_MOVE", cooldownMinutes: 5 }).success).toBe(false);
  });
});

describe("كلمات المرور", () => {
  it("يمنع كلمات المرور الضعيفة", () => {
    for (const p of ["short1!A", "alllowercase1!", "ALLUPPERCASE1!", "NoDigitsHere!!", "NoSymbols1234A", "Password123", "Aaaaaaa1!aaa"]) {
      expect(passwordSchema.safeParse(p).success, p).toBe(false);
    }
    expect(passwordSchema.safeParse("Str0ng!Passw0rd").success).toBe(true);
  });

  it("تأكيد كلمة المرور والموافقة على الشروط", () => {
    const base = { name: "أحمد", email: "a@example.com", password: "Str0ng!Passw0rd", confirmPassword: "Str0ng!Passw0rd", acceptTerms: true };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, confirmPassword: "x" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, name: "<b>x</b>" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, email: "bad" }).success).toBe(false);
  });
});

describe("الحماية من XSS وتسريب الأسرار", () => {
  it("يزيل وسوم HTML من النصوص", () => {
    expect(sanitizeText("<img src=x onerror=alert(1)>مرحبا<script>x</script>")).toBe("مرحباx");
  });

  it("يحجب الأسرار في السجلات", () => {
    const out = redact("failed api_key=SECRET123 and postgresql://user:pass@host/db token: abc");
    expect(out).not.toContain("SECRET123");
    expect(out).not.toContain("user:pass");
    expect(out).not.toContain("abc");
  });
});
