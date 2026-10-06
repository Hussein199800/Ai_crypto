import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChangeBadge } from "./change-badge";

interface StatCardProps {
  label: string;
  value: string;
  change?: number | null;
  changeUnit?: "%" | "pts";
  changeLabel?: string;
  hint?: string;
  updatedAt?: string;
  tone?: "positive" | "negative" | "warning" | "info" | "neutral";
  href?: string;
  icon?: LucideIcon;
  className?: string;
}

const TONE_BORDER = {
  positive: "border-positive/30",
  negative: "border-negative/30",
  warning: "border-warning/30",
  info: "border-info/30",
  neutral: "",
};

const TONE_TEXT = {
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
  info: "text-info",
  neutral: "text-foreground",
};

export function StatCard({ label, value, change, changeUnit, changeLabel, hint, updatedAt, tone = "neutral", href, icon: Icon, className }: StatCardProps) {
  const body = (
    <Card className={cn("flex h-full flex-col gap-2 p-4 transition-colors", TONE_BORDER[tone], href && "hover:bg-accent/40", className)}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {Icon && <Icon className="h-4 w-4" aria-hidden />}
          {label}
        </span>
        {href && <ChevronLeft className="h-4 w-4 opacity-60" aria-hidden />}
      </div>
      <div className={cn("num text-xl font-semibold sm:text-2xl", TONE_TEXT[tone])}>{value}</div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {change !== undefined ? <ChangeBadge value={change} label={changeLabel} unit={changeUnit} /> : <span />}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {updatedAt && <div className="text-[11px] text-muted-foreground">{updatedAt}</div>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${label}: ${value} — عرض التفاصيل`}>
      {body}
    </Link>
  ) : (
    body
  );
}
