import { timingSafeEqual } from "node:crypto";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getEnv, isMockMode } from "@/lib/env";
import { getMarketDataProvider } from "@/lib/providers";
import { evaluateAllAlerts } from "@/lib/services/alerts";
import { PrismaSnapshotStore } from "@/lib/services/snapshot-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * مهمة مجدولة (مثلًا كل 15 دقيقة): تحفظ لقطة للسوق العام لبناء تاريخ BTC.D/USDT.D/TOTAL،
 * وتقيّم تنبيهات المستخدمين، وتنظف سجلات المزودين القديمة.
 * الاستدعاء: Authorization: Bearer $CRON_SECRET
 */
async function run(req: Request) {
  try {
    if (!authorized(req)) return jsonError(401, "غير مصرح");
    const provider = getMarketDataProvider();
    let snapshot = false;
    if (!isMockMode()) {
      const [g, fng] = await Promise.all([provider.getGlobalMarketData(), provider.getFearGreedIndex().catch(() => null)]);
      if (!g.meta.isStale) {
        await new PrismaSnapshotStore().record(g, fng?.value ?? null, true);
        snapshot = true;
      }
    }
    const alerts = await evaluateAllAlerts();
    const cleaned = await prisma.dataProviderLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 14 * 86_400_000) } } });
    return jsonOk({ ok: true, snapshot, alerts, cleanedLogs: cleaned.count, at: new Date().toISOString() });
  } catch (e) {
    return handleApiError(e, "api.cron");
  }
}

export const GET = run;
export const POST = run;
