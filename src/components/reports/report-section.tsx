import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** إطار موحد لأقسام التقرير */
export function ReportSection({ id, title, subtitle, icon: Icon, children, className }: { id: string; title: string; subtitle?: string; icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("print-avoid-break scroll-mt-20", className)}>
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-positive/40 bg-positive/10 text-positive">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </Card>
    </section>
  );
}

export function KV({ label, value, tone, className }: { label: string; value: React.ReactNode; tone?: "positive" | "negative" | "warning" | "info"; className?: string }) {
  const toneCls = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : tone === "warning" ? "text-warning" : tone === "info" ? "text-info" : "";
  return (
    <div className={cn("rounded-lg border bg-background/40 p-3", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-semibold", toneCls)}>{value}</div>
    </div>
  );
}

export function BulletList({ items, tone }: { items: string[]; tone?: "positive" | "negative" | "warning" | "neutral" }) {
  const mark = tone === "positive" ? "✓" : tone === "negative" ? "✗" : tone === "warning" ? "!" : "•";
  const cls = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : tone === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className={cn("mt-0.5 shrink-0 font-bold", cls)} aria-hidden>
            {mark}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
