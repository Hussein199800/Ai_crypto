"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { CandlestickChart, Crosshair, Info, LineChart, Minus, Plus, RotateCcw, Ruler, Trash2, AreaChart as AreaIcon } from "lucide-react";
import { ASSETS, CHART_SYMBOLS, getAssetConfig } from "@/config/assets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/common/states";
import { DataFreshness } from "@/components/common/data-freshness";
import { apiGet, errorMessage } from "@/lib/client/fetcher";
import { formatAssetValue } from "@/lib/formatters";
import { TIMEFRAME_LABELS } from "@/lib/timeframes";
import type { ChartData } from "@/lib/services/charts";
import { TIMEFRAMES, type Timeframe } from "@/types/market";
import { cn } from "@/lib/utils";

type ChartKind = "candles" | "line" | "area";
type Overlay = "ema20" | "ema50" | "ema200" | "sma20" | "sma50" | "bb" | "sr";
type Pane = "volume" | "rsi" | "macd" | "obv";

const OVERLAYS: { key: Overlay; label: string; color: string }[] = [
  { key: "ema20", label: "EMA 20", color: "#38BDF8" },
  { key: "ema50", label: "EMA 50", color: "#F59E0B" },
  { key: "ema200", label: "EMA 200", color: "#A78BFA" },
  { key: "sma20", label: "SMA 20", color: "#F472B6" },
  { key: "sma50", label: "SMA 50", color: "#FB923C" },
  { key: "bb", label: "Bollinger", color: "#94A3B8" },
  { key: "sr", label: "دعم/مقاومة آلي", color: "#22C55E" },
];
const PANES: { key: Pane; label: string }[] = [
  { key: "volume", label: "الحجم Volume" },
  { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" },
  { key: "obv", label: "OBV" },
];
const COMPARE_COLORS = ["#22C55E", "#38BDF8", "#F59E0B", "#A78BFA", "#F472B6"];

const toTime = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

function lineData(times: number[], values: (number | null)[]) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  values.forEach((v, i) => {
    if (v != null && Number.isFinite(v)) out.push({ time: toTime(times[i]), value: v });
  });
  return out;
}

export function ChartWorkspace({ tradingViewConfigured }: { tradingViewConfigured: boolean }) {
  const params = useSearchParams();
  const initial = getAssetConfig(params.get("symbol") ?? "BTC")?.symbol ?? "BTC";
  const [symbol, setSymbol] = useState(initial);
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [kind, setKind] = useState<ChartKind>("candles");
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set(["ema50", "ema200", "sr"]));
  const [panes, setPanes] = useState<Set<Pane>>(new Set(["volume", "rsi"]));
  const [compare, setCompare] = useState<string[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [userLines, setUserLines] = useState<number[]>([]);
  const { resolvedTheme } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const drawModeRef = useRef(drawMode);
  drawModeRef.current = drawMode;

  const main = useQuery({
    queryKey: ["chart", symbol, timeframe, 500],
    queryFn: () => apiGet<ChartData>(`/api/charts/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=500`),
    refetchInterval: 120_000,
  });
  const compareQs = useQueries({
    queries: compare.map((s) => ({
      queryKey: ["chart", s, timeframe, 500],
      queryFn: () => apiGet<ChartData>(`/api/charts/${encodeURIComponent(s)}?timeframe=${timeframe}&limit=500`),
    })),
  });
  const compareData = compareQs.map((q) => q.data).filter((d): d is ChartData => Boolean(d));
  const comparing = compare.length > 0;

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setter(n);
  };

  const dark = resolvedTheme !== "light";
  const compareKey = compareData.map((d) => `${d.symbol}:${d.candles.length}`).join("|");

  useEffect(() => {
    const el = containerRef.current;
    const data = main.data;
    if (!el || !data || data.candles.length === 0) return;

    const text = dark ? "#8FA9A3" : "#3d5a54";
    const grid = dark ? "rgba(143,169,163,0.08)" : "rgba(0,0,0,0.06)";
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: text, fontFamily: "JetBrains Mono, monospace", panes: { separatorColor: grid } },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: timeframe !== "1d" && timeframe !== "1w" },
      localization: { locale: "en-US" },
    });
    chartRef.current = chart;
    const times = data.candles.map((c) => c.time);
    // تنسيق محور السعر للرسم الرئيسي فقط (المؤشرات السفلية تحتفظ بتنسيقها)
    const lastPrice = data.candles[data.candles.length - 1].close;
    const minMove = lastPrice >= 1000 ? 0.01 : lastPrice >= 1 ? 0.0001 : 0.00000001;
    const priceFormat = { type: "custom" as const, minMove, formatter: (p: number) => formatAssetValue(p, data.kind).replace("$", "") };
    const pctFormat = { type: "custom" as const, minMove: 0.01, formatter: (p: number) => `${p.toFixed(2)}%` };

    let mainSeries: ISeriesApi<SeriesType>;
    if (comparing) {
      // وضع المقارنة: نسبة التغير من أول شمعة مشتركة
      const all = [data, ...compareData];
      const start = Math.max(...all.map((d) => d.candles[0]?.time ?? 0));
      all.forEach((d, i) => {
        const cs = d.candles.filter((c) => c.time >= start);
        if (cs.length === 0) return;
        const base = cs[0].close;
        const s = chart.addSeries(LineSeries, { color: COMPARE_COLORS[i % COMPARE_COLORS.length], lineWidth: 2, title: d.display, priceLineVisible: false, priceFormat: pctFormat });
        s.setData(cs.map((c) => ({ time: toTime(c.time), value: ((c.close - base) / base) * 100 })));
        if (i === 0) mainSeries = s;
      });
      mainSeries ??= chart.addSeries(LineSeries, {});
    } else {
      if (kind === "candles") {
        mainSeries = chart.addSeries(CandlestickSeries, { priceFormat, upColor: "#22C55E", downColor: "#EF4444", borderVisible: false, wickUpColor: "#22C55E", wickDownColor: "#EF4444" });
        mainSeries.setData(data.candles.map((c) => ({ time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close })));
      } else if (kind === "line") {
        mainSeries = chart.addSeries(LineSeries, { priceFormat, color: "#22C55E", lineWidth: 2 });
        mainSeries.setData(data.candles.map((c) => ({ time: toTime(c.time), value: c.close })));
      } else {
        mainSeries = chart.addSeries(AreaSeries, { priceFormat, lineColor: "#22C55E", topColor: "rgba(34,197,94,0.35)", bottomColor: "rgba(34,197,94,0)", lineWidth: 2 });
        mainSeries.setData(data.candles.map((c) => ({ time: toTime(c.time), value: c.close })));
      }
      const ind = data.indicators;
      const addLine = (values: (number | null)[], color: string, title: string, style = LineStyle.Solid) => {
        const s = chart.addSeries(LineSeries, { priceFormat, color, lineWidth: 1, title, priceLineVisible: false, lastValueVisible: false, lineStyle: style, crosshairMarkerVisible: false });
        s.setData(lineData(times, values));
      };
      if (overlays.has("ema20")) addLine(ind.ema20, "#38BDF8", "EMA20");
      if (overlays.has("ema50")) addLine(ind.ema50, "#F59E0B", "EMA50");
      if (overlays.has("ema200")) addLine(ind.ema200, "#A78BFA", "EMA200");
      if (overlays.has("sma20")) addLine(ind.sma20, "#F472B6", "SMA20");
      if (overlays.has("sma50")) addLine(ind.sma50, "#FB923C", "SMA50");
      if (overlays.has("bb")) {
        addLine(ind.bbUpper, "#94A3B8", "BB+", LineStyle.Dotted);
        addLine(ind.bbLower, "#94A3B8", "BB-", LineStyle.Dotted);
      }
      if (overlays.has("sr")) {
        data.levels.supports.slice(0, 2).forEach((p, i) => mainSeries.createPriceLine({ price: p, color: "#22C55E", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `S${i + 1}` }));
        data.levels.resistances.slice(0, 2).forEach((p, i) => mainSeries.createPriceLine({ price: p, color: "#EF4444", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `R${i + 1}` }));
      }
      userLines.forEach((p) => mainSeries.createPriceLine({ price: p, color: "#38BDF8", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "خط" }));

      // المؤشرات أسفل الرسم في أجزاء مستقلة
      let paneIndex = 1;
      if (panes.has("volume") && data.hasVolume) {
        const v = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, title: "Volume", priceLineVisible: false }, paneIndex);
        v.setData(data.candles.map((c) => ({ time: toTime(c.time), value: c.volume, color: c.close >= c.open ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" })));
        const vma = chart.addSeries(LineSeries, { color: "#F59E0B", lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIndex);
        vma.setData(lineData(times, ind.volumeMA20));
        paneIndex++;
      }
      if (panes.has("rsi")) {
        const r = chart.addSeries(LineSeries, { color: "#38BDF8", lineWidth: 1, title: "RSI 14", priceLineVisible: false }, paneIndex);
        r.setData(lineData(times, ind.rsi14));
        r.createPriceLine({ price: 70, color: "#EF4444", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
        r.createPriceLine({ price: 30, color: "#22C55E", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
        paneIndex++;
      }
      if (panes.has("macd")) {
        const h = chart.addSeries(HistogramSeries, { title: "Hist", priceLineVisible: false }, paneIndex);
        h.setData(
          ind.macdHist.flatMap((v, i) => (v == null ? [] : [{ time: toTime(times[i]), value: v, color: v >= 0 ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)" }])),
        );
        chart.addSeries(LineSeries, { color: "#38BDF8", lineWidth: 1, title: "MACD", priceLineVisible: false }, paneIndex).setData(lineData(times, ind.macd));
        chart.addSeries(LineSeries, { color: "#F59E0B", lineWidth: 1, title: "Signal", priceLineVisible: false }, paneIndex).setData(lineData(times, ind.macdSignal));
        paneIndex++;
      }
      if (panes.has("obv") && data.hasVolume) {
        chart.addSeries(LineSeries, { color: "#A78BFA", lineWidth: 1, title: "OBV", priceLineVisible: false }, paneIndex).setData(lineData(times, ind.obv));
        paneIndex++;
      }
      // الرسم الرئيسي يأخذ المساحة الأكبر، وكل مؤشر سفلي حصة ثابتة أصغر
      const ps = chart.panes();
      ps.forEach((p, i) => p.setStretchFactor(i === 0 ? 3.5 : 1));
    }
    mainSeriesRef.current = mainSeries!;

    chart.subscribeClick((param) => {
      if (!drawModeRef.current || !param.point || !mainSeriesRef.current) return;
      const price = mainSeriesRef.current.coordinateToPrice(param.point.y);
      if (price != null && Number.isFinite(price)) setUserLines((ls) => [...ls, Number(price)].slice(-10));
    });
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [main.data, kind, overlays, panes, dark, comparing, compareKey, userLines, timeframe]);

  const zoom = (factor: number) => {
    const ts = chartRef.current?.timeScale();
    const r = ts?.getVisibleLogicalRange();
    if (!ts || !r) return;
    const mid = (r.from + r.to) / 2;
    const half = ((r.to - r.from) / 2) * factor;
    ts.setVisibleLogicalRange({ from: mid - half, to: mid + half });
  };

  const symbolOptions = useMemo(() => {
    const first = CHART_SYMBOLS.map((s) => getAssetConfig(s)!);
    const rest = ASSETS.filter((a) => !CHART_SYMBOLS.includes(a.symbol) && a.kind !== "STABLECOIN");
    return [...first, ...rest];
  }, []);

  const data = main.data;
  const insufficient = data && data.candles.length < 30;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">الرسوم البيانية</h1>
        <p className="text-sm text-muted-foreground">رسم سعري تفاعلي مع المؤشرات، المقارنة بين الأصول، وأدوات الرسم.</p>
      </div>

      {!tradingViewConfigured && (
        <div className="flex gap-2 rounded-lg border border-info/40 bg-info/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          <span>تكامل TradingView غير مُعدّ (لا يوجد مفتاح في ملف البيئة) — تُعرض رسوم محلية مبنية من بيانات مزودي البيانات المعتمدين. لا نستخدم أي استخراج غير مصرح به لبيانات TradingView.</span>
        </div>
      )}

      <Card className="grid gap-3 p-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="الأصل" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-44">
            {symbolOptions.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.display} — {a.nameAr}
              </option>
            ))}
          </Select>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="الإطار الزمني">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                aria-pressed={timeframe === tf}
                className={cn("rounded px-2.5 py-1 text-xs", timeframe === tf ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
              >
                {TIMEFRAME_LABELS[tf]}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="نوع الرسم">
            {(
              [
                ["candles", CandlestickChart, "شموع"],
                ["line", LineChart, "خطي"],
                ["area", AreaIcon, "مساحة"],
              ] as const
            ).map(([k, Icon, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                disabled={comparing}
                aria-pressed={kind === k}
                className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs disabled:opacity-40", kind === k ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => zoom(0.7)} aria-label="تكبير" title="تكبير">
            <Plus />
          </Button>
          <Button variant="outline" size="icon" onClick={() => zoom(1.4)} aria-label="تصغير" title="تصغير">
            <Minus />
          </Button>
          <Button variant="outline" size="icon" onClick={() => chartRef.current?.timeScale().fitContent()} aria-label="إعادة الضبط" title="إعادة الضبط">
            <RotateCcw />
          </Button>
          <Button variant={drawMode ? "default" : "outline"} size="sm" onClick={() => setDrawMode((d) => !d)} disabled={comparing} aria-pressed={drawMode} title="انقر على الرسم لإضافة خط دعم/مقاومة أفقي">
            <Ruler />
            {drawMode ? "انقر على الرسم" : "خط أفقي"}
          </Button>
          {userLines.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setUserLines([])}>
              <Trash2 />
              مسح الخطوط
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_17rem]">
        <Card className="p-2 sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-sm">
              <Crosshair className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="font-semibold">{getAssetConfig(symbol)?.display}</span>
              <span className="text-muted-foreground">· {TIMEFRAME_LABELS[timeframe]}</span>
              {comparing && <span className="text-xs text-info">وضع المقارنة (نسبة التغير %)</span>}
            </div>
            <DataFreshness meta={data?.meta} compact />
          </div>
          {main.isLoading ? (
            <Skeleton className="h-[480px]" />
          ) : main.isError ? (
            <ErrorState message={`${errorMessage(main.error)} — قد لا يتوفر مزود بيانات لهذا الأصل حاليًا.`} onRetry={() => main.refetch()} />
          ) : !data || data.candles.length === 0 ? (
            <div className="grid h-[480px] place-items-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              لا تتوفر بيانات تاريخية لهذا الأصل من المزود الحالي. {data?.meta.note}
            </div>
          ) : (
            <>
              {insufficient && <p className="mb-2 text-xs text-warning">بيانات محدودة ({data.candles.length} شمعة) — {data.meta.note}</p>}
              <div ref={containerRef} dir="ltr" className={cn("w-full", drawMode && "cursor-crosshair")} style={{ height: comparing ? 480 : 380 + panes.size * 110 }} />
            </>
          )}
          <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
            {comparing
              ? "تُعرض الأصول كنسبة تغير مئوية من أول شمعة مشتركة لتسهيل المقارنة بغض النظر عن السعر."
              : "الخطوط المتقطعة الخضراء والحمراء مستويات دعم ومقاومة محسوبة آليًا من القمم والقيعان؛ والخطوط الزرقاء خطوط أضفتها يدويًا. حرّك المؤشر لعرض القيم (Crosshair)، واستخدم العجلة أو الأزرار للتكبير."}
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-3">
            <h2 className="mb-2 text-sm font-semibold">مؤشرات على الرسم</h2>
            <div className="space-y-2">
              {OVERLAYS.map((o) => (
                <label key={o.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} aria-hidden />
                    {o.label}
                  </span>
                  <Switch checked={overlays.has(o.key)} onCheckedChange={() => toggle(overlays, o.key, setOverlays)} disabled={comparing} aria-label={o.label} />
                </label>
              ))}
            </div>
          </Card>
          <Card className="p-3">
            <h2 className="mb-2 text-sm font-semibold">مؤشرات أسفل الرسم</h2>
            <div className="space-y-2">
              {PANES.map((p) => (
                <label key={p.key} className="flex items-center justify-between gap-2 text-sm">
                  {p.label}
                  <Switch checked={panes.has(p.key)} onCheckedChange={() => toggle(panes, p.key, setPanes)} disabled={comparing} aria-label={p.label} />
                </label>
              ))}
            </div>
            {data && !data.hasVolume && <p className="mt-2 text-xs text-muted-foreground">لا تتوفر بيانات حجم لهذا المؤشر.</p>}
          </Card>
          <Card className="p-3">
            <h2 className="mb-2 text-sm font-semibold">مقارنة الأصول</h2>
            <div className="flex flex-wrap gap-1.5">
              {CHART_SYMBOLS.filter((s) => s !== symbol).map((s) => {
                const active = compare.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCompare((c) => (active ? c.filter((x) => x !== s) : [...c, s].slice(0, 4)))}
                    aria-pressed={active}
                    className={cn("rounded-full border px-2.5 py-1 text-xs", active ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent")}
                  >
                    {getAssetConfig(s)?.display}
                  </button>
                );
              })}
            </div>
            {compareQs.some((q) => q.isError) && <p className="mt-2 text-xs text-warning">تعذر تحميل بعض الأصول للمقارنة.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
