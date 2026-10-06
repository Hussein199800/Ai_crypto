import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/** نسبة تغير مع سهم ولون — اللون ليس الدلالة الوحيدة (السهم والإشارة أيضًا) */
export function ChangeBadge({ value, className, label, unit = "%" }: { value: number | null | undefined; className?: string; label?: string; unit?: "%" | "pts" }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={cn("text-xs text-muted-foreground", className)}>غير متاح</span>;
  }
  const up = value > 0;
  const down = value < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const text = unit === "pts" ? `${up ? "+" : down ? "-" : ""}${Math.abs(value).toFixed(2)} نقطة` : formatPercent(value);
  return (
    <span
      className={cn("num inline-flex items-center gap-0.5 text-xs font-semibold", up && "text-positive", down && "text-negative", !up && !down && "text-muted-foreground", className)}
      aria-label={`${label ? `${label}: ` : ""}${up ? "ارتفاع" : down ? "انخفاض" : "بدون تغير"} ${text}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {text}
    </span>
  );
}
