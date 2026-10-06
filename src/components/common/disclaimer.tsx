import { ShieldAlert } from "lucide-react";
import { DISCLAIMER } from "@/lib/formatters/labels";
import { cn } from "@/lib/utils";

export function Disclaimer({ className, short = false }: { className?: string; short?: boolean }) {
  return (
    <div role="note" className={cn("flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-foreground/90 sm:text-sm", className)}>
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <p>{short ? "تقييم آلي وإشارة تحليلية — ليس نصيحة مالية. النتائج سيناريوهات محتملة وليست ضمانًا." : DISCLAIMER}</p>
    </div>
  );
}
