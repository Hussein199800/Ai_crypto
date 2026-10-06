import { ClipboardList, Flag, Layers3, TriangleAlert } from "lucide-react";
import { formatPrice, formatNumber } from "@/lib/formatters";
import { DECISION_LABELS } from "@/lib/formatters/labels";
import type { AnalysisReportData, Scenario } from "@/types/analysis";
import { cn } from "@/lib/utils";
import { BulletList, KV, ReportSection } from "./report-section";

const TONE_TEXT = { positive: "text-positive", negative: "text-negative", info: "text-info", warning: "text-warning" } as const;

const SC_STYLE: Record<Scenario["type"], string> = {
  POSITIVE: "border-positive/40",
  NEUTRAL: "border-warning/40",
  NEGATIVE: "border-negative/40",
};
const SC_TITLE: Record<Scenario["type"], string> = {
  POSITIVE: "text-positive",
  NEUTRAL: "text-warning",
  NEGATIVE: "text-negative",
};

export function ScenariosSection({ report }: { report: AnalysisReportData }) {
  return (
    <ReportSection id="scenarios" title="السيناريوهات المحتملة" icon={Layers3} subtitle="سيناريوهات شرطية لمساعدتك على التخطيط — ليست توقعات مؤكدة. الترجيح النسبي مبني على الدرجة الحالية فقط.">
      <div className="grid gap-3 lg:grid-cols-3">
        {report.scenarios.map((s) => (
          <article key={s.type} className={cn("print-avoid-break rounded-lg border-2 bg-background/40 p-4", SC_STYLE[s.type])}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={cn("font-bold", SC_TITLE[s.type])}>{s.title}</h3>
              <span className="rounded-full border px-2 py-0.5 text-[11px]">ترجيح: {s.likelihood}</span>
            </div>
            <h4 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">{s.type === "NEGATIVE" ? "عوامل الضعف" : s.type === "NEUTRAL" ? "عوامل الانتظار" : "الشروط المطلوبة"}</h4>
            <BulletList items={s.conditions} />
            {s.range && (
              <p className="mt-3 text-sm">
                نطاق الحركة المتوقع: <span className="num">{formatPrice(s.range.low)}</span> — <span className="num">{formatPrice(s.range.high)}</span>
              </p>
            )}
            <h4 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">{s.type === "NEGATIVE" ? "مستويات الخطر" : "مستويات مهمة"}</h4>
            <ul className="space-y-1 text-sm">
              {s.levels.map((l) => (
                <li key={l.label} className="flex justify-between gap-2">
                  <span>{l.label}</span>
                  <span className="num">{formatPrice(l.value)}</span>
                </li>
              ))}
            </ul>
            <h4 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">ما الذي يؤكده؟</h4>
            <BulletList items={s.confirmations} tone="positive" />
            <h4 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">ما الذي يبطله؟</h4>
            <BulletList items={s.invalidations} tone="negative" />
            {s.watch.length > 0 && (
              <>
                <h4 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">ما الذي يجب مراقبته؟</h4>
                <BulletList items={s.watch} tone="warning" />
              </>
            )}
          </article>
        ))}
      </div>
    </ReportSection>
  );
}

export function LevelsSection({ report }: { report: AnalysisReportData }) {
  const l = report.levels;
  return (
    <ReportSection id="levels" title="مستويات مهمة" icon={Flag} subtitle="مستويات مشتقة من البيانات فقط — يظهر 'غير متاح' عندما لا تكفي البيانات بدلًا من اختلاق أرقام.">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KV label="الدعم الأول" value={<span className="num">{formatPrice(l.support1)}</span>} tone="positive" />
        <KV label="الدعم الثاني" value={<span className="num">{formatPrice(l.support2)}</span>} tone="positive" />
        <KV label="المقاومة الأولى" value={<span className="num">{formatPrice(l.resistance1)}</span>} tone="negative" />
        <KV label="المقاومة الثانية" value={<span className="num">{formatPrice(l.resistance2)}</span>} tone="negative" />
        <KV label="منطقة اهتمام/دخول محتملة (سيناريو)" value={<span className="num">{l.entryZone ? `${formatPrice(l.entryZone.low)} — ${formatPrice(l.entryZone.high)}` : "غير متاح"}</span>} tone="info" className="col-span-2" />
        <KV label="مستوى إبطال الفكرة" value={<span className="num">{formatPrice(l.invalidation)}</span>} tone="warning" />
        <KV label="أهداف محتملة (سيناريو وليست ضمانًا)" value={<span className="num">{l.targets.length ? l.targets.map((t) => formatPrice(t)).join(" ، ") : "غير متاح"}</span>} />
      </div>
      {l.fibonacci.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">مستويات فيبوناتشي Fibonacci</h3>
          <div className="flex flex-wrap gap-2">
            {l.fibonacci.map((f) => (
              <span key={f.level} className="rounded-md border px-2 py-1 text-xs">
                <span className="num">{formatNumber(f.level * 100, 1)}%</span>: <span className="num">{formatPrice(f.price)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{l.method}</p>
      {l.notes.length > 0 && (
        <div className="mt-2">
          <BulletList items={l.notes} tone="warning" />
        </div>
      )}
    </ReportSection>
  );
}

export function SummarySection({ report }: { report: AnalysisReportData }) {
  const s = report.summary;
  const tone = s.decision === "GRADUAL_BUY" ? "positive" : s.decision === "AVOID" ? "negative" : s.decision === "WATCH" ? "info" : "warning";
  return (
    <ReportSection id="summary" title="ملخص التقرير" icon={ClipboardList}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-background/40 p-3">
            <h3 className="mb-1 text-sm font-semibold">الخلاصة الفنية</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.technical}</p>
          </div>
          <div className="rounded-lg border bg-background/40 p-3">
            <h3 className="mb-1 text-sm font-semibold">الخلاصة السوقية</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.market}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-positive/30 p-3">
            <h3 className="mb-2 text-sm font-semibold text-positive">عوامل القوة</h3>
            <BulletList items={s.strengths} tone="positive" />
          </div>
          <div className="rounded-lg border border-negative/30 p-3">
            <h3 className="mb-2 text-sm font-semibold text-negative">عوامل الضعف</h3>
            <BulletList items={s.weaknesses} tone="negative" />
          </div>
          <div className="rounded-lg border border-warning/30 p-3">
            <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-warning">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              أهم المخاطر
            </h3>
            <BulletList items={s.risks} tone="warning" />
          </div>
          <div className="rounded-lg border p-3">
            <h3 className="mb-2 text-sm font-semibold">ما الذي يجب مراقبته؟</h3>
            <BulletList items={s.watch} />
          </div>
        </div>
        <div className={cn("rounded-lg border-2 p-4", tone === "positive" ? "border-positive/50" : tone === "negative" ? "border-negative/50" : tone === "info" ? "border-info/50" : "border-warning/50")}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">القرار المقترح (تقييم آلي):</h3>
            <span className={cn("text-lg font-bold", TONE_TEXT[tone])}>{DECISION_LABELS[s.decision]}</span>
          </div>
          <h4 className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">سبب القرار</h4>
          <BulletList items={s.decisionReasons} />
        </div>
      </div>
    </ReportSection>
  );
}

export function DataQualityNotice({ report }: { report: AnalysisReportData }) {
  const dq = report.dataQuality;
  const important = dq.issues.filter((i) => i.severity !== "info");
  if (important.length === 0 && !dq.insufficient) return null;
  return (
    <div role="alert" className={cn("rounded-xl border p-4", dq.insufficient ? "border-negative/50 bg-negative/10" : "border-warning/50 bg-warning/10")}>
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <TriangleAlert className={cn("h-5 w-5", dq.insufficient ? "text-negative" : "text-warning")} aria-hidden />
        {dq.insufficient ? "البيانات غير كافية — لا تُصدر إشارة قوية" : "تنبيه حول جودة البيانات"}
        <span className="num text-xs font-normal text-muted-foreground">(جودة البيانات {dq.score}%)</span>
      </div>
      <BulletList items={dq.issues.map((i) => i.message)} tone="warning" />
    </div>
  );
}
