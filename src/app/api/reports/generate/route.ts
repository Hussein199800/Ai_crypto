import { assertSameOrigin, handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getViewer } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { generateReport } from "@/lib/services/reports";
import { firstError, generateReportSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** إنشاء تقرير جديد — محمي بتحديد معدل أشد للزوار */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    const key = viewer ? `gen:user:${viewer.id}` : `gen:ip:${clientIp(req.headers)}`;
    const rl = rateLimit(key, viewer ? 20 : 6, 60 * 60_000);
    if (!rl.ok) {
      return jsonError(429, "تجاوزت الحد المسموح لإنشاء التقارير. حاول لاحقًا.", { retryAfter: rl.retryAfterSec }, { "Retry-After": String(rl.retryAfterSec) });
    }
    const burst = rateLimit(`${key}:burst`, 3, 60_000);
    if (!burst.ok) return jsonError(429, "طلبات متتالية كثيرة. انتظر قليلًا ثم أعد المحاولة.", { retryAfter: burst.retryAfterSec });
    const parsed = generateReportSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, firstError(parsed.error));
    const report = await generateReport(parsed.data, viewer);
    return jsonOk(report, { status: 201 });
  } catch (e) {
    return handleApiError(e, "api.reports.generate");
  }
}
