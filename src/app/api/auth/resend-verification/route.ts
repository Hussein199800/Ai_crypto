import { assertSameOrigin, handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { sendVerificationEmail } from "@/lib/services/account";
import { firstError, resendVerificationSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const rl = rateLimit(`resend:${clientIp(req.headers)}`, 3, 60 * 60_000);
    if (!rl.ok) return jsonError(429, "محاولات كثيرة. حاول لاحقًا.");
    const parsed = resendVerificationSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error));
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user && !user.emailVerified) await sendVerificationEmail(user.email);
    return jsonOk({ ok: true, message: "إذا كان الحساب بحاجة لتأكيد فستصلك رسالة جديدة." });
  } catch (e) {
    return handleApiError(e, "api.resend");
  }
}
