"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, Info, Plus, Star, Trash2 } from "lucide-react";
import { ASSETS, getAssetConfig } from "@/config/assets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChangeBadge } from "@/components/common/change-badge";
import { EmptyState, ErrorState } from "@/components/common/states";
import { RecommendationBadge } from "@/components/common/signal-badges";
import { useWatchlist } from "@/hooks/use-watchlist";
import { apiGet, errorMessage } from "@/lib/client/fetcher";
import { formatAssetValue, formatRelative } from "@/lib/formatters";
import type { AssetOverview } from "@/types/market";
import type { Recommendation } from "@/types/analysis";
import { STATIC_MODE } from "@/lib/static-mode";
import { reportPath } from "@/lib/routes";

type AssetRow = AssetOverview & { analysis: { score: number; recommendation: Recommendation; createdAt: string; id: string } | null };
type SortKey = "custom" | "name" | "change" | "score";

export function WatchlistView() {
  const wl = useWatchlist();
  const [toAdd, setToAdd] = useState("BTC");
  const [sort, setSort] = useState<SortKey>("custom");
  const key = wl.symbols.join(",");
  const q = useQuery({
    queryKey: ["assets", key],
    queryFn: () => apiGet<{ assets: AssetRow[] }>(`/api/assets?symbols=${encodeURIComponent(key)}`),
    enabled: wl.symbols.length > 0,
    refetchInterval: 120_000,
  });

  const rows = useMemo(() => {
    const map = new Map((q.data?.assets ?? []).map((a) => [a.symbol, a]));
    const list = wl.symbols.map((s) => ({ symbol: s, asset: map.get(s) ?? null }));
    if (sort === "name") list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    if (sort === "change") list.sort((a, b) => (b.asset?.change24h ?? -Infinity) - (a.asset?.change24h ?? -Infinity));
    if (sort === "score") list.sort((a, b) => (b.asset?.analysis?.score ?? -1) - (a.asset?.analysis?.score ?? -1));
    return list;
  }, [q.data, wl.symbols, sort]);

  const move = (symbol: string, dir: -1 | 1) => {
    const arr = [...wl.symbols];
    const i = arr.indexOf(symbol);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    wl.setOrder(arr);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">المفضلة</h1>
        <p className="text-sm text-muted-foreground">تابع العملات التي تهمك وافتح تقاريرها بسرعة.</p>
      </div>
      {!wl.authed && (
        <div className="flex gap-2 rounded-lg border border-info/40 bg-info/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          {STATIC_MODE ? (
            <span>تُحفظ المفضلة في هذا المتصفح فقط (النسخة الثابتة لا تدعم الحسابات) وقد تُفقد عند مسح بيانات المتصفح.</span>
          ) : (
            <span>
              أنت غير مسجل: تُحفظ المفضلة في هذا المتصفح فقط وقد تُفقد عند مسح بيانات المتصفح.{" "}
              <Link href="/login?callbackUrl=/watchlist" className="text-primary underline">
                سجّل الدخول
              </Link>{" "}
              لحفظها في حسابك.
            </span>
          )}
        </div>
      )}
      <Card className="flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-[14rem] flex-1">
          <Select aria-label="اختر أصلًا" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
            {ASSETS.map((a) => (
              <option key={a.symbol} value={a.symbol} disabled={wl.has(a.symbol)}>
                {a.display} — {a.nameAr}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => !wl.has(toAdd) && wl.toggle(toAdd)} disabled={wl.has(toAdd)}>
          <Plus />
          إضافة
        </Button>
        <div className="w-48">
          <Select aria-label="الترتيب" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="custom">ترتيبي المخصص</option>
            <option value="name">حسب الاسم</option>
            <option value="change">حسب التغير 24 ساعة</option>
            <option value="score">حسب درجة التحليل</option>
          </Select>
        </div>
      </Card>

      {wl.loading ? (
        <Skeleton className="h-64" />
      ) : wl.symbols.length === 0 ? (
        <EmptyState icon={Star} title="المفضلة فارغة" description="أضف عملات لمتابعة أسعارها ودرجات تحليلها." />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الأصل</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>24 ساعة</TableHead>
                <TableHead>7 أيام</TableHead>
                <TableHead>درجة التحليل</TableHead>
                <TableHead>آخر إشارة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ symbol, asset }, idx) => {
                const cfg = getAssetConfig(symbol);
                return (
                  <TableRow key={symbol}>
                    <TableCell>
                      <div className="font-semibold">{cfg?.display ?? symbol}</div>
                      <div className="text-xs text-muted-foreground">{cfg?.nameAr}</div>
                    </TableCell>
                    <TableCell className="num whitespace-nowrap">{q.isLoading ? <Skeleton className="h-4 w-16" /> : formatAssetValue(asset?.price, cfg?.kind ?? "CRYPTO")}</TableCell>
                    <TableCell>{q.isLoading ? <Skeleton className="h-4 w-12" /> : <ChangeBadge value={asset?.change24h} />}</TableCell>
                    <TableCell>{q.isLoading ? <Skeleton className="h-4 w-12" /> : <ChangeBadge value={asset?.change7d} />}</TableCell>
                    <TableCell className="num">
                      {asset?.analysis ? (
                        <span>
                          <span className="font-bold">{asset.analysis.score}</span>/100
                          <span className="block text-[11px] text-muted-foreground">{formatRelative(asset.analysis.createdAt)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">لا يوجد تقرير</span>
                      )}
                    </TableCell>
                    <TableCell>{asset?.analysis ? <RecommendationBadge value={asset.analysis.recommendation} /> : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {sort === "custom" && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => move(symbol, -1)} disabled={idx === 0} aria-label={`نقل ${symbol} للأعلى`}>
                              <ArrowUp />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => move(symbol, 1)} disabled={idx === rows.length - 1} aria-label={`نقل ${symbol} للأسفل`}>
                              <ArrowDown />
                            </Button>
                          </>
                        )}
                        <Button asChild variant="outline" size="sm">
                          <Link href={reportPath(symbol)}>
                            <ExternalLink />
                            التقرير
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => wl.toggle(symbol)} aria-label={`حذف ${symbol} من المفضلة`}>
                          <Trash2 className="text-negative" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
