"use client";

import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/client/fetcher";
import { formatAssetValue, formatDate } from "@/lib/formatters";
import type { ChartData } from "@/lib/services/charts";
import type { AnalysisReportData } from "@/types/analysis";
import { HORIZON_PRIMARY_TIMEFRAME } from "@/config/scoring";
import { TIMEFRAME_LABELS } from "@/lib/timeframes";

/** رسم مختصر للسعر مع مستويات الدعم والمقاومة من التقرير */
export function ReportPriceChart({ report }: { report: AnalysisReportData }) {
  const tf = HORIZON_PRIMARY_TIMEFRAME[report.horizon];
  const q = useQuery({
    queryKey: ["chart", report.symbol, tf, 150],
    queryFn: () => apiGet<ChartData>(`/api/charts/${encodeURIComponent(report.symbol)}?timeframe=${tf}&limit=150`),
    staleTime: 120_000,
  });
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError || !q.data || q.data.candles.length < 2) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">الرسم البياني غير متاح لهذا الأصل حاليًا (لا تتوفر بيانات تاريخية كافية).</p>;
  }
  const data = q.data.candles.map((c) => ({ t: c.time, close: c.close }));
  const first = data[0].close;
  const last = data[data.length - 1].close;
  const up = last >= first;
  const color = up ? "#22C55E" : "#EF4444";
  const l = report.levels;
  return (
    <figure>
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
            <XAxis dataKey="t" tickFormatter={(t) => formatDate(t)} minTickGap={40} tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} />
            <YAxis domain={["auto", "auto"]} orientation="right" width={70} tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} tickFormatter={(v) => formatAssetValue(v, report.kind)} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(t) => formatDate(t as number)}
              formatter={(v) => [formatAssetValue(Number(v), report.kind), "الإغلاق"]}
            />
            <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill="url(#pc)" isAnimationActive={false} />
            {l.support1 != null && <ReferenceLine y={l.support1} stroke="#22C55E" strokeDasharray="4 4" label={{ value: "S1", fill: "#22C55E", fontSize: 11, position: "insideLeft" }} />}
            {l.resistance1 != null && <ReferenceLine y={l.resistance1} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "R1", fill: "#EF4444", fontSize: 11, position: "insideLeft" }} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        إغلاقات آخر {data.length} شمعة على إطار {TIMEFRAME_LABELS[tf]} ({up ? "ارتفاع" : "انخفاض"} خلال الفترة). الخطان المتقطعان يمثلان الدعم الأول (S1) والمقاومة الأولى (R1) المستخدمين في التقرير. الرسم الحالي قد يختلف عن وقت إنشاء التقرير.
      </figcaption>
    </figure>
  );
}
