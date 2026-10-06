"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Bitcoin, CircleDollarSign, Gauge, Landmark, Sparkles } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { ErrorState } from "@/components/common/states";
import { DataFreshness } from "@/components/common/data-freshness";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, errorMessage } from "@/lib/client/fetcher";
import { formatCompact, formatNumber, formatPercent, formatRelative } from "@/lib/formatters";
import type { DashboardData } from "@/lib/services/market";
import { MarketStatePanel } from "./market-state-panel";
import { MoversList } from "./movers-list";
import { LatestReports } from "./latest-reports";
import { MarketAlerts } from "./market-alerts";

export function DashboardView() {
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardData>("/api/market/overview"),
    refetchInterval: 120_000,
  });

  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data;
  const updated = d ? formatRelative(d.meta.dataTime ?? d.meta.fetchedAt) : undefined;
  const fg = d?.fearGreed;
  const fgTone = fg ? (fg.value >= 75 ? "warning" : fg.value >= 55 ? "positive" : fg.value <= 25 ? "negative" : "neutral") : "neutral";
  const udc = d?.dominance?.usdtDominanceChange24h ?? null;

  return (
    <div className="space-y-8">
      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">المؤشرات العامة</h2>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <DataFreshness meta={d?.meta} />
        </div>
        {q.isLoading || !d ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="إجمالي القيمة السوقية"
              icon={Landmark}
              value={formatCompact(d.global?.totalMarketCap)}
              change={d.global?.marketCapChange24h ?? null}
              changeLabel="24 ساعة"
              tone={toneOf(d.global?.marketCapChange24h)}
              updatedAt={updated}
              href="/reports/TOTAL"
            />
            <StatCard
              label="تغير السوق خلال 24 ساعة"
              icon={Activity}
              value={formatPercent(d.global?.marketCapChange24h)}
              hint={d.state.trend === "UP" ? "صاعد" : d.state.trend === "DOWN" ? "هابط" : "عرضي"}
              tone={toneOf(d.global?.marketCapChange24h)}
              updatedAt={updated}
              href="/charts?symbol=TOTAL"
            />
            <StatCard
              label="هيمنة البيتكوين BTC.D"
              icon={Bitcoin}
              value={d.dominance?.btcDominance != null ? `${formatNumber(d.dominance.btcDominance, 2)}%` : "غير متاح"}
              change={d.dominance?.btcDominanceChange24h ?? null}
              changeUnit="pts"
              tone="info"
              updatedAt={updated}
              href="/reports/BTC.D"
            />
            <StatCard
              label="هيمنة تيثر USDT.D"
              icon={CircleDollarSign}
              value={d.dominance?.usdtDominance != null ? `${formatNumber(d.dominance.usdtDominance, 2)}%` : "غير متاح"}
              change={udc}
              changeUnit="pts"
              hint={udc != null && udc > 0.15 ? "ارتفاع قوي ⚠" : undefined}
              tone={udc != null && udc > 0.15 ? "warning" : "neutral"}
              updatedAt={updated}
              href="/reports/USDT.D"
            />
            <StatCard
              label="مؤشر الخوف والطمع"
              icon={Gauge}
              value={fg ? `${fg.value} / 100` : "غير متاح"}
              hint={fg?.classificationAr}
              change={fg && fg.history.length > 1 ? fg.value - fg.history[fg.history.length - 2].value : undefined}
              changeUnit="pts"
              tone={fgTone}
              updatedAt={fg ? formatRelative(fg.timestamp) : undefined}
              href="/about#indicators"
            />
            <StatCard
              label="حجم التداول 24 ساعة"
              icon={BarChart3}
              value={formatCompact(d.global?.totalVolume24h)}
              hint={d.global?.totalVolume24h && d.global.totalMarketCap ? `${((d.global.totalVolume24h / d.global.totalMarketCap) * 100).toFixed(2)}% من القيمة السوقية` : undefined}
              tone="neutral"
              updatedAt={updated}
              href="/charts?symbol=TOTAL"
            />
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MarketStatePanel data={d} loading={q.isLoading} />
        </div>
        <MarketAlerts alerts={d?.alerts} loading={q.isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MoversList title="العملات الأكثر قوة" icon={Sparkles} items={d?.strongest} loading={q.isLoading} tone="positive" />
        <MoversList title="العملات الأكثر ضعفًا" icon={Activity} items={d?.weakest} loading={q.isLoading} tone="negative" />
      </div>

      <LatestReports />
    </div>
  );
}

function toneOf(v: number | null | undefined) {
  if (v == null) return "neutral" as const;
  return v > 0 ? ("positive" as const) : v < 0 ? ("negative" as const) : ("neutral" as const);
}
