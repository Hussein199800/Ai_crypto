import { DirectionBadge } from "@/components/common/signal-badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORY_LABELS } from "@/config/scoring";
import type { IndicatorSignal } from "@/types/analysis";
import { cn } from "@/lib/utils";

export function IndicatorTable({ signals }: { signals: IndicatorSignal[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>المؤشر</TableHead>
          <TableHead>القيمة الحالية</TableHead>
          <TableHead>الحالة</TableHead>
          <TableHead>الأثر</TableHead>
          <TableHead>المساهمة</TableHead>
          <TableHead className="min-w-[16rem]">الشرح</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {signals.map((s) => (
          <TableRow key={s.key} className={cn(!s.available && "opacity-60")}>
            <TableCell>
              <div className="font-medium">{s.nameAr}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">
                {s.nameEn} · {CATEGORY_LABELS[s.category]}
              </div>
            </TableCell>
            <TableCell className="num whitespace-nowrap text-xs">{s.valueText}</TableCell>
            <TableCell className="text-xs">{s.status}</TableCell>
            <TableCell>{s.available ? <DirectionBadge value={s.direction} /> : <span className="text-xs text-muted-foreground">لا يدخل في الحساب</span>}</TableCell>
            <TableCell className={cn("num whitespace-nowrap text-xs font-semibold", s.contribution > 0 ? "text-positive" : s.contribution < 0 ? "text-negative" : "text-muted-foreground")}>
              {s.available ? `${s.contribution > 0 ? "+" : ""}${s.contribution.toFixed(2)}` : "—"}
            </TableCell>
            <TableCell className="text-xs leading-relaxed text-muted-foreground">{s.explanation}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
