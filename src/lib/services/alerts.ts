import type { Viewer } from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { logError } from "@/lib/logger";
import { getMarketDataProvider } from "@/lib/providers";
import { computeIndicators, trendOf } from "@/lib/analysis/timeframe";
import { evaluateAlert, type AlertContext } from "@/lib/alerts/evaluate";
import { closedCandles } from "@/lib/timeframes";
import type { z } from "zod";
import type { alertCreateSchema } from "@/lib/validators";

const MAX_ALERTS = 30;

export async function listAlerts(viewer: Viewer) {
  const [alerts, events] = await Promise.all([
    prisma.alert.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" } }),
    prisma.alertEvent.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return { alerts, events };
}

export async function createAlert(viewer: Viewer, input: z.infer<typeof alertCreateSchema>) {
  const count = await prisma.alert.count({ where: { userId: viewer.id } });
  if (count >= MAX_ALERTS) throw new HttpError(400, `الحد الأقصى للتنبيهات ${MAX_ALERTS}`);
  const dup = await prisma.alert.findFirst({ where: { userId: viewer.id, symbol: input.symbol, type: input.type, isActive: true } });
  if (dup) throw new HttpError(409, "يوجد تنبيه مماثل مفعّل لهذا الأصل");
  return prisma.alert.create({ data: { userId: viewer.id, ...input } });
}

export async function deleteAlert(viewer: Viewer, id: string) {
  const res = await prisma.alert.deleteMany({ where: { id, userId: viewer.id } });
  if (res.count === 0) throw new HttpError(404, "التنبيه غير موجود");
}

/** تقييم جميع التنبيهات النشطة (يُستدعى من مهمة مجدولة محمية بـ CRON_SECRET) */
export async function evaluateAllAlerts(): Promise<{ evaluated: number; triggered: number }> {
  const alerts = await prisma.alert.findMany({ where: { isActive: true }, take: 500 });
  if (alerts.length === 0) return { evaluated: 0, triggered: 0 };
  const provider = getMarketDataProvider();
  const dominance = await provider.getDominanceData().catch(() => null);
  const contexts = new Map<string, AlertContext>();
  let triggered = 0;

  for (const symbol of [...new Set(alerts.map((a) => a.symbol))]) {
    try {
      const [overview, daily] = await Promise.all([provider.getAssetOverview(symbol).catch(() => null), provider.getOHLCV(symbol, "1d").catch(() => null)]);
      const candles = daily ? closedCandles(daily.candles, "1d") : [];
      const c = candles.length >= 50 ? computeIndicators(candles, "1d") : null;
      contexts.set(symbol, {
        price: overview?.price ?? c?.price ?? null,
        change24h: overview?.change24h ?? null,
        support1: c?.supports[0]?.price ?? null,
        resistance1: c?.resistances[0]?.price ?? null,
        ema20: c?.ema20 ?? null,
        ema50: c?.ema50 ?? null,
        trend: c ? trendOf(c) : "UNKNOWN",
        btcDominanceChange24h: dominance?.btcDominanceChange24h ?? null,
        usdtDominanceChange24h: dominance?.usdtDominanceChange24h ?? null,
      });
    } catch (e) {
      logError("alerts.context", e);
    }
  }

  for (const a of alerts) {
    const ctx = contexts.get(a.symbol);
    if (!ctx) continue;
    const r = evaluateAlert(a, ctx);
    if (r.triggered && r.message) {
      triggered++;
      await prisma.$transaction([
        prisma.alertEvent.create({ data: { alertId: a.id, userId: a.userId, message: r.message, value: r.value } }),
        prisma.alert.update({ where: { id: a.id }, data: { lastTriggeredAt: new Date(), lastState: r.newState } }),
      ]);
    } else if (r.newState !== a.lastState) {
      await prisma.alert.update({ where: { id: a.id }, data: { lastState: r.newState } });
    }
  }
  return { evaluated: alerts.length, triggered };
}
