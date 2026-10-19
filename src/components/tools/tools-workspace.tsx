"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, MinusCircle, RefreshCw, Search } from "lucide-react";
import { ASSETS, getAssetConfig } from "@/config/assets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataFreshness } from "@/components/common/data-freshness";
import { Disclaimer } from "@/components/common/disclaimer";
import { ErrorState } from "@/components/common/states";
import { apiGet, errorMessage } from "@/lib/client/fetcher";
import { formatAssetValue } from "@/lib/formatters";
import { TIMEFRAME_LABELS } from "@/lib/timeframes";
import { TOOL_CATALOG } from "@/lib/tools/registry";
import type { ToolsResponse } from "@/lib/tools/run";
import { TOOL_CATEGORY_LABELS, type ToolCategory } from "@/lib/tools/types";
import { TIMEFRAMES, type Timeframe } from "@/types/market";
import { cn } from "@/lib/utils";
import { DailyCloseCountdown, FearGreedCard } from "./market-clock";
import { RiskCalculator } from "./risk-calculator";
import { ToolCard } from "./tool-card";

const FAV_KEY = "cryptoscope:tool-favorites:v1";
type Filter = "all" | "favorites" | ToolCategory;

function readFavs(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(FAV_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function ToolsWorkspace() {
  const params = useSearchParams();
  const [symbol, setSymbol] = useState(getAssetConfig(params.get("symbol") ?? "BTC")?.symbol ?? "BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => setFavs(readFavs()), []);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      /* التخزين غير متاح */
    }
  };

  const q = useQuery({
    queryKey: ["tools", symbol, timeframe],
    queryFn: () => apiGet<ToolsResponse>(`/api/tools/${encodeURIComponent(symbol)}?timeframe=${timeframe}`),
    staleTime: 60_000,
  });
  const cfg = getAssetConfig(symbol);
  const kind = cfg?.kind ?? "CRYPTO";
  const byId = useMemo(() => new Map((q.data?.results ?? []).map((r) => [r.id, r])), [q.data]);

  const visible = TOOL_CATALOG.filter((t) => {
    if (filter === "favorites" && !favs.includes(t.id)) return false;
    if (filter !== "all" && filter !== "favorites" && t.category !== filter) return false;
    const s = search.trim().toLowerCase();
    return !s || t.nameAr.includes(search.trim()) || t.nameEn.toLowerCase().includes(s) || t.descriptionAr.toLowerCase().includes(s);
  });

  const scored = (q.data?.results ?? []).filter((r) => r.status === "ok" && r.score !== null);
  const bull = scored.filter((r) => r.verdict === "bullish").length;
  const bear = scored.filter((r) => r.verdict === "bearish").length;
  const neutral = scored.length - bull - bear;
  const unified = byId.get("tools6");
  const riskPlan = byId.get("risk-plan");
  const stop = riskPlan?.levels?.find((l) => l.label === "وقف الخسارة")?.price;
  const target = riskPlan?.levels?.find((l) => l.label.startsWith("هدف"))?.price;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">أدوات التحليل</h1>
        <p className="text-sm text-muted-foreground">29 أداة تحليل فني وإحصائي تعمل على بيانات حية — كل أداة تعرض نتيجتها وشرحها بالعربية.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DailyCloseCountdown />
        <FearGreedCard />
      </div>

      <Card className="grid gap-3 p-3 lg:grid-cols-[auto_auto_1fr]">
        <Select aria-label="الأصل" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full lg:w-52">
          {ASSETS.map((a) => (
            <option key={a.symbol} value={a.symbol}>
              {a.display} — {a.nameAr}
            </option>
          ))}
        </Select>
        <div className="scroll-x flex rounded-md border p-0.5" role="group" aria-label="الإطار الزمني">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              aria-pressed={timeframe === tf}
              className={cn("whitespace-nowrap rounded px-3 py-1.5 text-xs", timeframe === tf ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
            >
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن أداة (مثال: SMC، إيشيموكو، Monte)" className="ps-9" aria-label="بحث في الأدوات" />
        </div>
      </Card>

      <div className="scroll-x flex gap-2 pb-1" role="tablist" aria-label="تصنيف الأدوات">
        {(["all", "favorites", ...Object.keys(TOOL_CATEGORY_LABELS)] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs", filter === f ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent")}
          >
            {f === "all" ? "الكل" : f === "favorites" ? `★ المفضلة (${favs.length})` : TOOL_CATEGORY_LABELS[f as ToolCategory]}
          </button>
        ))}
      </div>

      {q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{cfg?.display}</span>
              <span className="num text-lg">{q.isLoading ? "…" : formatAssetValue(q.data?.price ?? null, kind)}</span>
              <span className="text-xs text-muted-foreground">· {TIMEFRAME_LABELS[timeframe]}</span>
            </div>
            {q.data && <DataFreshness meta={{ source: q.data.sources.join("، ") || "—", fetchedAt: q.data.generatedAt, isStale: q.data.isStale, isMock: q.data.isMock }} />}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {unified?.status === "ok" && <span className="rounded-full border px-3 py-1">التصويت الموحد: {unified.headline}</span>}
            <span className="inline-flex items-center gap-1 text-positive"><ArrowUpCircle className="h-4 w-4" aria-hidden /> {bull}</span>
            <span className="inline-flex items-center gap-1 text-warning"><MinusCircle className="h-4 w-4" aria-hidden /> {neutral}</span>
            <span className="inline-flex items-center gap-1 text-negative"><ArrowDownCircle className="h-4 w-4" aria-hidden /> {bear}</span>
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={q.isFetching ? "animate-spin" : ""} />
              تحديث
            </Button>
          </div>
        </Card>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{filter === "favorites" ? "لم تضف أي أداة إلى المفضلة بعد — اضغط النجمة على أي أداة." : "لا توجد أدوات مطابقة للبحث."}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <ToolCard key={t.id} tool={t} result={byId.get(t.id)} loading={q.isLoading} kind={kind} favorite={favs.includes(t.id)} onToggleFavorite={() => toggleFav(t.id)} />
          ))}
        </div>
      )}

      {(filter === "all" || filter === "risk") && <RiskCalculator key={`${symbol}-${q.data?.generatedAt ?? ""}`} defaults={{ entry: q.data?.price ?? undefined, stop, target }} />}

      <Disclaimer />
    </div>
  );
}
