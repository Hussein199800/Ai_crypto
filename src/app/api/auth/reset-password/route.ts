import { assertSameOrigin, handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { resetPassword } from "@/lib/services/account";
import { fieldErrors, firstError, resetPasswordSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const rl = rateLimit(`reset:${clientIp(req.headers)}`, 10, 60 * 60_000);
    if (!rl.ok) return jsonError(429, "محاولات كثيرة. حاول لاحقًا.");
    const parsed = resetPasswordSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error), { fields: fieldErrors(parsed.error) });
    await resetPassword(parsed.data.token, parsed.data.password);
    return jsonOk({ ok: true, message: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن." });
  } catch (e) {
    return handleApiError(e, "api.reset");
  }
}
