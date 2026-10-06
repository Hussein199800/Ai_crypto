import Link from "next/link";
import { Bell, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/common/section-title";
import type { MarketAlertItem } from "@/lib/analysis/market-state";
import { cn } from "@/lib/utils";
import { reportPath } from "@/lib/routes";

const ICONS = { info: Info, warning: TriangleAlert, critical: OctagonAlert };
const TONES = { info: "text-info", warning: "text-warning", critical: "text-negative" };

export function MarketAlerts({ alerts, loading }: { alerts?: MarketAlertItem[]; loading: boolean }) {
  return (
    <section aria-labelledby="alerts-title">
      <SectionTitle id="alerts-title" title="تنبيهات السوق" icon={Bell} />
      <Card className="divide-y">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3">
              <Skeleton className="h-12" />
            </div>
          ))
        ) : !alerts || alerts.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">لا توجد تنبيهات مهمة حاليًا. نعرض فقط التغيرات التي تتجاوز عتبات واضحة لتجنب الإزعاج.</div>
        ) : (
          alerts.map((a) => {
            const Icon = ICONS[a.severity];
            const body = (
              <div className="flex gap-3 p-3">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONES[a.severity])} aria-hidden />
                <div>
                  <div className="text-sm font-medium">{a.title}</div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{a.message}</p>
                </div>
              </div>
            );
            return a.symbol ? (
              <Link key={a.id} href={reportPath(a.symbol)} className="block hover:bg-accent/40">
                {body}
              </Link>
            ) : (
              <div key={a.id}>{body}</div>
            );
          })
        )}
      </Card>
    </section>
  );
}
