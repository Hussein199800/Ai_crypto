import { assertSameOrigin, handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { requestPasswordReset } from "@/lib/services/account";
import { firstError, forgotPasswordSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const rl = rateLimit(`forgot:${clientIp(req.headers)}`, 5, 60 * 60_000);
    if (!rl.ok) return jsonError(429, "محاولات كثيرة. حاول لاحقًا.", undefined, { "Retry-After": String(rl.retryAfterSec) });
    const parsed = forgotPasswordSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error));
    await requestPasswordReset(parsed.data.email);
    return jsonOk({ ok: true, message: "إذا كان البريد مسجلًا لدينا فستصلك رسالة تحتوي على رابط إعادة التعيين." });
  } catch (e) {
    return handleApiError(e, "api.forgot");
  }
}
