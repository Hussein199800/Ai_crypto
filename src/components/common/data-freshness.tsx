"use client";

import { Clock, Database, FlaskConical, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDateTime, formatRelative } from "@/lib/formatters";
import type { DataMeta } from "@/types/market";
import { cn } from "@/lib/utils";

/** يوضح وقت آخر تحديث والمصدر، وينبه إذا كانت البيانات قديمة أو تجريبية */
export function DataFreshness({ meta, className, compact = false }: { meta: DataMeta | null | undefined; className?: string; compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!meta) return null;
  const t = meta.dataTime ?? meta.fetchedAt;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1" title={formatDateTime(t)}>
        <Clock className="h-3.5 w-3.5" aria-hidden />
        آخر تحديث: {now ? formatRelative(t, now) : formatDateTime(t)}
      </span>
      {!compact && (
        <span className="inline-flex items-center gap-1">
          <Database className="h-3.5 w-3.5" aria-hidden />
          المصدر: {meta.source}
        </span>
      )}
      {meta.isStale && (
        <span className="inline-flex items-center gap-1 text-warning">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
          بيانات غير محدثة — ليست لحظية
        </span>
      )}
      {meta.isMock && (
        <span className="inline-flex items-center gap-1 text-warning">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          بيانات تجريبية
        </span>
      )}
    </div>
  );
}
