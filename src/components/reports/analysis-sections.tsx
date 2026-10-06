import { Activity, BarChart3, Compass, Droplets, Globe2 } from "lucide-react";
import { formatCompact, formatNumber, formatPercent, formatPrice, formatDateTime } from "@/lib/formatters";
import { PHASE_LABELS, TREND_LABELS } from "@/lib/formatters/labels";
import type { AnalysisReportData, TrendDirection } from "@/types/analysis";
import { ChangeBadge } from "@/components/common/change-badge";
import { DirectionBadge } from "@/components/common/signal-badges";
import { BulletList, KV, ReportSection } from "./report-section";

const trendTone = (t: TrendDirection) => (t === "UP" ? "positive" : t === "DOWN" ? "negative" : t === "SIDEWAYS" ? "warning" : undefined);

export function TrendSection({ report }: { report: AnalysisReportData }) {
  const t = report.trend;
  return (
    <ReportSection id="trend" title="تحليل الاتجاه" icon={Compass} subtitle={t.description}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KV label="قصير المدى" value={TREND_LABELS[t.short]} tone={trendTone(t.short)} />
        <KV label="متوسط المدى" value={TREND_LABELS[t.medium]} tone={trendTone(t.medium)} />
        <KV label="طويل المدى" value={TREND_LABELS[t.long]} tone={trendTone(t.long)} />
        <KV label="قوة الاتجاه (ADX)" value={<span>{t.strengthLabel} <span className="num text-xs text-muted-foreground">{t.strength != null ? formatNumber(t.strength, 1) : ""}</span></span>} />
      </div>
      <h3 className="mb-2 mt-5 text-sm font-semibold">السعر بالنسبة إلى المتوسطات المتحركة</h3>
      {t.priceVsMAs.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {t.priceVsMAs.map((m) => (
            <div key={m.key} className="rounded-lg border bg-background/40 p-2.5 text-xs">
              <div className="font-medium" dir="ltr">{m.label}</div>
              <div className="num mt-1">{formatPrice(m.value)}</div>
              <div className={m.above == null ? "text-muted-foreground" : m.above ? "text-positive" : "text-negative"}>
                {m.above == null ? "غير متاح" : `${m.above ? "▲ السعر فوقه" : "▼ السعر تحته"} (${formatPercent(m.distancePct)})`}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">غير متاح.</p>
      )}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <KV label="التقاطع الذهبي / تقاطع الموت" value={<span className="font-normal leading-relaxed">{t.cross.description}</span>} tone={t.cross.type === "GOLDEN" ? "positive" : t.cross.type === "DEATH" ? "negative" : undefined} />
        <KV
          label="القمم والقيعان"
          value={
            <div className="space-y-1 font-normal">
              <div>{t.swings.description}</div>
              {t.swings.highs.length > 0 && <div className="num text-xs text-muted-foreground">قمم: {t.swings.highs.map((h) => formatPrice(h.price)).join(" ← ")}</div>}
              {t.swings.lows.length > 0 && <div className="num text-xs text-muted-foreground">قيعان: {t.swings.lows.map((h) => formatPrice(h.price)).join(" ← ")}</div>}
            </div>
          }
        />
        <KV label="منطقة السعر الحالية" value={<span className="font-normal">{t.zoneDescription}</span>} tone={t.zone === "NEAR_SUPPORT" ? "positive" : t.zone === "NEAR_RESISTANCE" ? "warning" : undefined} />
      </div>
    </ReportSection>
  );
}

export function MomentumSection({ report }: { report: AnalysisReportData }) {
  const m = report.momentum;
  return (
    <ReportSection id="momentum" title="الزخم" icon={Activity} subtitle={m.description}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <KV label="مؤشر القوة النسبية RSI" value={<span className="num">{m.rsi != null ? formatNumber(m.rsi, 1) : "غير متاح"}</span>} />
        <KV label="حالة RSI" value={m.rsiState} />
        <KV label="MACD / الإشارة" value={<span className="num text-xs">{m.macd ? `${formatNumber(m.macd.macd, 4)} / ${formatNumber(m.macd.signal, 4)}` : "غير متاح"}</span>} tone={m.macd ? (m.macd.histogram > 0 ? "positive" : "negative") : undefined} />
        <KV label="معدل تغير السعر ROC 10" value={<ChangeBadge value={m.roc} />} />
        <KV label="قوة المشترين (تقديرية)" value={<span className="num">{m.buyPressure != null ? `${m.buyPressure.toFixed(0)}% مشترين / ${(100 - m.buyPressure).toFixed(0)}% بائعين` : "غير متاح"}</span>} />
        <KV label="اتجاه الزخم" value={m.trend === "IMPROVING" ? "يتحسن ▲" : m.trend === "WEAKENING" ? "يضعف ▼" : m.trend === "STABLE" ? "مستقر" : "غير واضح"} tone={m.trend === "IMPROVING" ? "positive" : m.trend === "WEAKENING" ? "negative" : undefined} />
      </div>
      <p className="mt-3 text-sm">
        <span className="font-medium">الانفراج (Divergence): </span>
        {m.divergence.description}
      </p>
    </ReportSection>
  );
}

const LIQ = { HIGH: "مرتفعة", MEDIUM: "متوسطة", LOW: "ضعيفة", UNKNOWN: "غير متاح" } as const;

export function VolumeSection({ report }: { report: AnalysisReportData }) {
  const v = report.volume;
  return (
    <ReportSection id="volume" title="الحجم والسيولة" icon={Droplets} subtitle={v.description}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KV label="حجم آخر شمعة مكتملة" value={<span className="num">{formatCompact(v.currentVolume)}</span>} />
        <KV label="متوسط الحجم (20)" value={<span className="num">{formatCompact(v.averageVolume)}</span>} />
        <KV label="تغير الحجم عن المتوسط" value={<ChangeBadge value={v.volumeChangePct} />} />
        <KV label="حجم التداول 24 ساعة" value={<span className="num">{formatCompact(v.volume24h)}</span>} />
        <KV label="السيولة" value={LIQ[v.liquidityLevel]} tone={v.liquidityLevel === "HIGH" ? "positive" : v.liquidityLevel === "LOW" ? "negative" : "warning"} />
        <KV label="الحجم / القيمة السوقية" value={<span className="num">{v.volumeToMarketCap != null ? `${v.volumeToMarketCap.toFixed(2)}%` : "غير متاح"}</span>} />
        <KV label="فارق السعر Spread" value={<span className="num">{v.spreadPct != null ? `${v.spreadPct.toFixed(3)}%` : "غير متاح"}</span>} />
        <KV
          label="هل الحركة مدعومة بالحجم؟"
          value={v.supportedByVolume == null ? "لا توجد حركة صاعدة لتأكيدها" : v.supportedByVolume ? "نعم ✓" : "لا ✗"}
          tone={v.supportedByVolume == null ? undefined : v.supportedByVolume ? "positive" : "negative"}
        />
      </div>
      {v.warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <BulletList items={v.warnings} tone="warning" />
        </div>
      )}
    </ReportSection>
  );
}

export function MarketSection({ report }: { report: AnalysisReportData }) {
  const m = report.market;
  return (
    <ReportSection id="market" title="تحليل السوق العام" icon={Globe2} subtitle="ربط التقرير بحالة السوق: لا يُعتمد على مؤشر واحد، بل على العلاقة بين المؤشرات.">
      {!m.available ? (
        <p className="text-sm text-muted-foreground">بيانات السوق العامة غير متاحة حاليًا.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <KV label="اتجاه البيتكوين BTC (يومي)" value={TREND_LABELS[m.btcTrend]} tone={trendTone(m.btcTrend)} />
            <KV label="اتجاه الإيثريوم ETH (يومي)" value={TREND_LABELS[m.ethTrend]} tone={trendTone(m.ethTrend)} />
            <KV label="هيمنة البيتكوين BTC.D" value={<span className="num">{m.btcDominance != null ? `${formatNumber(m.btcDominance, 2)}%` : "غير متاح"} <ChangeBadge value={m.btcDominanceChange24h} unit="pts" /></span>} />
            <KV label="هيمنة تيثر USDT.D" value={<span className="num">{m.usdtDominance != null ? `${formatNumber(m.usdtDominance, 2)}%` : "غير متاح"} <ChangeBadge value={m.usdtDominanceChange24h} unit="pts" /></span>} />
            <KV label="إجمالي السوق TOTAL" value={<span className="num">{formatCompact(m.totalMarketCap)} <ChangeBadge value={m.totalChange24h} /></span>} />
            <KV label="TOTAL2 (دون BTC)" value={<span className="num">{formatCompact(m.total2)}</span>} />
            <KV label="TOTAL3 (دون BTC وETH)" value={<span className="num">{formatCompact(m.total3)}</span>} />
            <KV label="نسبة ETH/BTC" value={TREND_LABELS[m.ethBtcTrend]} tone={trendTone(m.ethBtcTrend)} />
            <KV label="مؤشر الخوف والطمع" value={m.fearGreed ? `${m.fearGreed.value} — ${m.fearGreed.classificationAr}` : "غير متاح"} />
            <KV label="اتجاه السوق العام" value={TREND_LABELS[m.marketTrend]} tone={trendTone(m.marketTrend)} />
            <KV label="مرحلة السوق" value={PHASE_LABELS[m.phase]} className="col-span-2" />
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">العلاقة بين المؤشرات</h3>
          <BulletList items={m.relations} />
          {m.signals.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {m.signals.map((s) => (
                <div key={s.key} className="rounded-lg border bg-background/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.nameAr} <span className="text-xs text-muted-foreground" dir="ltr">{s.nameEn}</span></span>
                    <DirectionBadge value={s.direction} />
                  </div>
                  <div className="mt-1 text-xs">{s.status}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.explanation}</div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            طريقة حساب الهيمنة: {m.dominanceMethod} — تاريخ البيانات: {formatDateTime(m.dataTime)}. تدفق السيولة التفصيلي (On-chain) غير متاح في مصادر البيانات الحالية.
          </p>
        </>
      )}
    </ReportSection>
  );
}

export function RiskSection({ report }: { report: AnalysisReportData }) {
  const r = report.risk;
  return (
    <ReportSection id="risk" title="المخاطر والتقلب" icon={BarChart3}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KV label="درجة المخاطرة" value={<span className="num">{r.score} / 100</span>} tone={r.level === "LOW" ? "positive" : r.level === "HIGH" ? "negative" : "warning"} />
        <KV label="ATR كنسبة من السعر" value={<span className="num">{r.atrPct != null ? `${r.atrPct.toFixed(2)}%` : "غير متاح"}</span>} />
        <KV label="التقلب السنوي (30 يومًا)" value={<span className="num">{r.volatility30d != null ? `${r.volatility30d.toFixed(0)}%` : "غير متاح"}</span>} />
        <KV label="أقصى تراجع (90 يومًا)" value={<span className="num">{r.maxDrawdown90d != null ? formatPercent(r.maxDrawdown90d) : "غير متاح"}</span>} />
      </div>
      {r.factors.length > 0 && (
        <div className="mt-3">
          <BulletList items={r.factors} tone="warning" />
        </div>
      )}
    </ReportSection>
  );
}
