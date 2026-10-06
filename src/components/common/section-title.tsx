import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionTitle({ title, subtitle, icon: Icon, action, className, id }: { title: string; subtitle?: string; icon?: LucideIcon; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-2", className)}>
      <div>
        <h2 id={id} className="flex items-center gap-2 text-lg font-bold">
          {Icon && (
            <span className="grid h-7 w-7 place-items-center rounded-md border border-positive/40 bg-positive/10 text-positive">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          )}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
