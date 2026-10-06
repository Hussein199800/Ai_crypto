import { assertSameOrigin, handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { verifyEmail } from "@/lib/services/account";
import { firstError, verifyEmailSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const rl = rateLimit(`verify:${clientIp(req.headers)}`, 20, 60 * 60_000);
    if (!rl.ok) return jsonError(429, "محاولات كثيرة. حاول لاحقًا.");
    const parsed = verifyEmailSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error));
    await verifyEmail(parsed.data.token);
    return jsonOk({ ok: true, message: "تم تأكيد بريدك الإلكتروني بنجاح." });
  } catch (e) {
    return handleApiError(e, "api.verify");
  }
}
