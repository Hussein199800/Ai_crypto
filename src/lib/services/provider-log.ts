import { prisma } from "@/lib/db";
import { redact } from "@/lib/logger";
import type { ProviderCallLog } from "@/lib/providers/http";

/**
 * يسجل استدعاءات مزودي البيانات في DataProviderLog.
 * تُسجَّل جميع الأخطاء، وعينة 10% من الطلبات الناجحة لتقليل الحمل.
 */
export function logProviderCall(entry: ProviderCallLog) {
  if (entry.ok && Math.random() > 0.1) return;
  prisma.dataProviderLog
    .create({
      data: {
        provider: entry.provider,
        endpoint: entry.endpoint,
        status: entry.status,
        ok: entry.ok,
        durationMs: entry.durationMs,
        error: entry.error ? redact(entry.error).slice(0, 500) : null,
      },
    })
    .catch(() => undefined);
}
