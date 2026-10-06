import { z } from "zod";
import { isSupportedSymbol, normalizeSymbol } from "@/config/assets";
import { TIMEFRAMES } from "@/types/market";

/** رسائل أخطاء عربية افتراضية لكل مخططات Zod */
const arabicErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === "undefined" ? "حقل مطلوب مفقود" : "نوع القيمة غير صالح" };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `قيمة غير مسموحة. القيم المتاحة: ${issue.options.join("، ")}` };
    case z.ZodIssueCode.too_small:
      return { message: issue.type === "string" ? `القيمة قصيرة جدًا (الحد الأدنى ${issue.minimum})` : `القيمة أقل من الحد الأدنى (${issue.minimum})` };
    case z.ZodIssueCode.too_big:
      return { message: issue.type === "string" ? `القيمة طويلة جدًا (الحد الأقصى ${issue.maximum})` : `القيمة أكبر من الحد الأقصى (${issue.maximum})` };
    case z.ZodIssueCode.invalid_string:
      return { message: "صيغة النص غير صالحة" };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: "حقول غير معروفة في الطلب" };
    default:
      return { message: ctx.defaultError === "Required" ? "حقل مطلوب" : "قيمة غير صالحة" };
  }
};
z.setErrorMap(arabicErrorMap);

/** رمز أصل مدعوم — يُطبَّع إلى الصيغة القياسية */
export const symbolSchema = z
  .string({ required_error: "الرمز مطلوب" })
  .trim()
  .min(1, "الرمز مطلوب")
  .max(20, "الرمز طويل جدًا")
  .regex(/^[A-Za-z0-9./_-]+$/, "الرمز يحتوي على أحرف غير مسموحة")
  .transform((s) => normalizeSymbol(s))
  .refine((s) => isSupportedSymbol(s), { message: "الرمز غير مدعوم" });

export const timeframeSchema = z.enum(TIMEFRAMES, { errorMap: () => ({ message: "الإطار الزمني غير صالح" }) });
export const horizonSchema = z.enum(["SHORT", "MEDIUM", "LONG"], { errorMap: () => ({ message: "الأفق الزمني غير صالح" }) });

export const generateReportSchema = z.object({
  symbol: symbolSchema,
  horizon: horizonSchema.default("MEDIUM"),
  visibility: z.enum(["public", "private"]).default("public"),
});
export type GenerateReportInput = z.infer<typeof generateReportSchema>;

export const reportsQuerySchema = z.object({
  q: z.string().trim().max(40).optional(),
  recommendation: z.enum(["buy", "neutral", "avoid", "sell"]).optional(),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  horizon: horizonSchema.optional(),
  sort: z.enum(["newest", "confidence", "score", "change"]).default("newest"),
  mine: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

export const chartQuerySchema = z.object({
  timeframe: timeframeSchema.default("1d"),
  limit: z.coerce.number().int().min(50).max(1000).default(300),
});

export const reportIdSchema = z.string().trim().regex(/^c[a-z0-9]{20,32}$/, "معرّف التقرير غير صالح");

export const watchlistAddSchema = z.object({ symbol: symbolSchema });
export const watchlistReorderSchema = z.object({
  symbols: z.array(symbolSchema).max(100, "عدد العناصر كبير جدًا"),
});

export const alertCreateSchema = z.object({
  symbol: symbolSchema,
  type: z.enum(["PRICE_MOVE", "SUPPORT_BREAK", "RESISTANCE_BREAK", "BTC_D_CHANGE", "USDT_D_RISE", "EMA_CROSS", "TREND_CHANGE"]),
  threshold: z.coerce.number().positive("القيمة يجب أن تكون موجبة").max(1e12).optional(),
  cooldownMinutes: z.coerce.number().int().min(30, "أقل فترة تهدئة 30 دقيقة").max(10_080).default(240),
});

// ───────────── المصادقة ─────────────

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop",
  "11111111", "iloveyou", "admin123", "welcome1", "abc12345", "letmein1", "passw0rd", "00000000", "Aa123456",
  "P@ssw0rd", "Password1", "Password123", "Qwerty123", "1q2w3e4r", "zaq12wsx",
]);

export const emailSchema = z
  .string({ required_error: "البريد الإلكتروني مطلوب" })
  .trim()
  .toLowerCase()
  .max(254, "البريد الإلكتروني طويل جدًا")
  .email("صيغة البريد الإلكتروني غير صحيحة");

/** كلمة مرور قوية: 10 أحرف على الأقل، حرف كبير وصغير ورقم ورمز، وليست شائعة */
export const passwordSchema = z
  .string({ required_error: "كلمة المرور مطلوبة" })
  .min(10, "كلمة المرور يجب أن تكون 10 أحرف على الأقل")
  .max(128, "كلمة المرور طويلة جدًا")
  .refine((p) => /[a-z]/.test(p), "يجب أن تحتوي على حرف إنجليزي صغير")
  .refine((p) => /[A-Z]/.test(p), "يجب أن تحتوي على حرف إنجليزي كبير")
  .refine((p) => /\d/.test(p), "يجب أن تحتوي على رقم")
  .refine((p) => /[^A-Za-z0-9]/.test(p), "يجب أن تحتوي على رمز خاص مثل ! أو @")
  .refine((p) => !COMMON_PASSWORDS.has(p) && !COMMON_PASSWORDS.has(p.toLowerCase()), "كلمة المرور شائعة جدًا وسهلة التخمين")
  .refine((p) => !/(.)\1{3,}/.test(p), "تجنب تكرار نفس الحرف أكثر من 3 مرات");

export const nameSchema = z
  .string({ required_error: "الاسم مطلوب" })
  .trim()
  .min(2, "الاسم قصير جدًا")
  .max(60, "الاسم طويل جدًا")
  .refine((n) => !/[<>"'`&]/.test(n), "الاسم يحتوي على رموز غير مسموحة");

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: "تأكيد كلمة المرور مطلوب" }),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "يجب الموافقة على شروط الاستخدام" }) }),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "كلمتا المرور غير متطابقتين", path: ["confirmPassword"] })
  .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0].toLowerCase()) || d.email.split("@")[0].length < 4, {
    message: "كلمة المرور يجب ألا تحتوي على اسم المستخدم من البريد",
    path: ["password"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "كلمة المرور مطلوبة").max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "كلمتا المرور غير متطابقتين", path: ["confirmPassword"] });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const resendVerificationSchema = z.object({ email: emailSchema });

/** أول رسالة خطأ عربية من نتيجة Zod */
export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "بيانات غير صالحة";
}

/** خريطة أخطاء الحقول لعرضها في النماذج */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** معرّف cuid عام */
export const idSchema = reportIdSchema;
