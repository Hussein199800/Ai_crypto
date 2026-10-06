import { Compass, Droplets, ShieldAlert, TrendingDown, TrendingUp, MoveHorizontal, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/common/section-title";
import { PHASE_LABELS, RISK_LABELS, TREND_LABELS } from "@/lib/formatters/labels";
import type { DashboardData } from "@/lib/services/market";
import { cn } from "@/lib/utils";

const LIQ = { HIGH: "مرتفعة", MEDIUM: "متوسطة", LOW: "ضعيفة", UNKNOWN: "غير متاح" } as const;

export function MarketStatePanel({ data, loading }: { data?: DashboardData; loading: boolean }) {
  const s = data?.state;
  const items = s
    ? [
        {
          label: "اتجاه السوق",
          value: TREND_LABELS[s.trend],
          icon: s.trend === "UP" ? TrendingUp : s.trend === "DOWN" ? TrendingDown : MoveHorizontal,
          tone: s.trend === "UP" ? "text-positive" : s.trend === "DOWN" ? "text-negative" : "text-warning",
        },
        {
          label: "حالة السيولة",
          value: LIQ[s.liquidity],
          icon: Droplets,
          tone: s.liquidity === "HIGH" ? "text-positive" : s.liquidity === "LOW" ? "text-negative" : "text-warning",
        },
        {
          label: "مستوى المخاطرة",
          value: RISK_LABELS[s.risk],
          icon: ShieldAlert,
          tone: s.risk === "LOW" ? "text-positive" : s.risk === "HIGH" ? "text-negative" : "text-warning",
        },
        {
          label: "مرحلة السوق",
          value: PHASE_LABELS[s.phase],
          icon: Layers,
          tone: s.phase === "RISK_OFF" ? "text-negative" : s.phase === "NEUTRAL" ? "text-muted-foreground" : "text-info",
        },
      ]
    : [];
  return (
    <section aria-labelledby="state-title">
      <SectionTitle id="state-title" title="حالة السوق الحالية" icon={Compass} subtitle="قراءة مركبة من إجمالي السوق، الهيمنة، السيولة، ومعنويات السوق." />
      <Card className="p-4">
        {loading || !s ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {items.map((it) => (
                <div key={it.label} className="rounded-lg border bg-background/40 p-3">
                  <div className="text-xs text-muted-foreground">{it.label}</div>
                  <div className={cn("mt-2 flex items-center gap-1.5 text-sm font-semibold", it.tone)}>
                    <it.icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{it.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              تُحدَّد المرحلة من تغير هيمنة البيتكوين وتيثر وإجمالي السوق معًا، ولا تُعد توصية بحد ذاتها. {s.notes.join(" ")}
            </p>
          </>
        )}
      </Card>
    </section>
  );
}
