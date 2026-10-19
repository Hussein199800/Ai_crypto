"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/common/score-gauge";
import { apiGet } from "@/lib/client/fetcher";
import type { FearGreedData } from "@/types/market";

/** عدّاد إغلاق الشمعة اليومية للبيتكوين (منتصف الليل UTC) */
export function DailyCloseCountdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = now === null ? null : 86_400_000 - (now % 86_400_000);
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0")).join(":");
  };
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-4 text-center">
      <div className="text-sm font-semibold text-primary">الإغلاق اليومي للبيتكوين</div>
      <div className="num text-3xl font-bold tracking-widest sm:text-4xl" aria-live="off">{remaining === null ? "--:--:--" : fmt(remaining)}</div>
      <div className="text-xs text-muted-foreground">متبقٍ على إغلاق شمعة اليوم (00:00 UTC)</div>
    </Card>
  );
}

export function FearGreedCard() {
  const q = useQuery({ queryKey: ["fear-greed"], queryFn: () => apiGet<FearGreedData>("/api/market/fear-greed"), staleTime: 600_000 });
  return (
    <Card className="flex flex-col items-center justify-center gap-1 p-4">
      <div className="text-sm font-semibold text-primary">الخوف والطمع</div>
      {q.isLoading ? <Skeleton className="h-24 w-40" /> : q.data ? <ScoreGauge value={q.data.value} label={q.data.classificationAr} size={160} /> : <div className="text-sm text-muted-foreground">غير متاح حاليًا</div>}
    </Card>
  );
}
