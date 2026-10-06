import { assertSameOrigin, handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { registerUser } from "@/lib/services/account";
import { fieldErrors, firstError, registerSchema } from "@/lib/validators";
import { getEnv } from "@/lib/env";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const rl = rateLimit(`register:${clientIp(req.headers)}`, 5, 60 * 60_000);
    if (!rl.ok) return jsonError(429, "محاولات كثيرة لإنشاء حساب. حاول لاحقًا.", undefined, { "Retry-After": String(rl.retryAfterSec) });
    const parsed = registerSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error), { fields: fieldErrors(parsed.error) });
    await registerUser(parsed.data);
    const verify = getEnv().REQUIRE_EMAIL_VERIFICATION;
    return jsonOk({
      ok: true,
      requiresVerification: verify,
      message: verify
        ? "إذا كان البريد صالحًا فستصلك رسالة لتأكيد الحساب. يرجى تأكيد بريدك قبل تسجيل الدخول."
        : "تم إنشاء الحساب بنجاح. يمكنك تسجيل الدخول الآن.",
    });
  } catch (e) {
    return handleApiError(e, "api.register");
  }
}
