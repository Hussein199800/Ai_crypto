import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/common/section-title";
import { ChangeBadge } from "@/components/common/change-badge";
import { EmptyState } from "@/components/common/states";
import { formatPrice, formatRelative } from "@/lib/formatters";
import type { RankedAsset } from "@/lib/analysis/dashboard";
import { reportPath } from "@/lib/routes";

export function MoversList({ title, icon, items, loading, tone }: { title: string; icon: LucideIcon; items?: RankedAsset[]; loading: boolean; tone: "positive" | "negative" }) {
  return (
    <section>
      <SectionTitle title={title} icon={icon} subtitle="ترتيب حسب القوة السعرية النسبية (7 أيام، 24 ساعة، 30 يومًا) — وليس درجة تحليل." />
      <Card className="divide-y">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3">
              <Skeleton className="h-10" />
            </div>
          ))
        ) : !items || items.length === 0 ? (
          <EmptyState title="لا توجد بيانات" description="تعذر جلب أسعار العملات حاليًا." className="m-3 border-0" />
        ) : (
          items.map((r) => (
            <Link key={r.overview.symbol} href={reportPath(r.overview.symbol)} className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/40">
              <div className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-bold ${tone === "positive" ? "border-positive/40 text-positive" : "border-negative/40 text-negative"}`}>
                {r.overview.symbol.slice(0, 4)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.overview.symbol}</span>
                  <span className="truncate text-xs text-muted-foreground">{r.overview.nameAr ?? r.overview.name}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>
                    7 أيام: <ChangeBadge value={r.overview.change7d} />
                  </span>
                  {r.score && <span>درجة التحليل: <span className="num font-semibold text-foreground">{r.score.score}</span> ({formatRelative(r.score.createdAt)})</span>}
                </div>
              </div>
              <div className="text-end">
                <div className="num text-sm font-semibold">{formatPrice(r.overview.price)}</div>
                <ChangeBadge value={r.overview.change24h} label="24 ساعة" />
              </div>
            </Link>
          ))
        )}
      </Card>
    </section>
  );
}
