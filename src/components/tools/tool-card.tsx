"use client";

import { ArrowDownCircle, ArrowUpCircle, Info, MinusCircle, Star, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAssetValue } from "@/lib/formatters";
import { TIMEFRAME_LABELS } from "@/lib/timeframes";
import type { ToolCatalogEntry } from "@/lib/tools/registry";
import type { Tone, ToolResult } from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { FALLBACK_ICON, TOOL_ICONS } from "./tool-icons";

const VERDICT = {
  bullish: { label: "ميل إيجابي", variant: "positive", icon: ArrowUpCircle },
  bearish: { label: "ميل سلبي", variant: "negative", icon: ArrowDownCircle },
  neutral: { label: "محايد", variant: "warning", icon: MinusCircle },
  info: { label: "معلوماتي", variant: "info", icon: Info },
} as const;

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
  info: "text-info",
  neutral: "",
};

export function ToolCard({ tool, result, loading, kind, favorite, onToggleFavorite }: { tool: ToolCatalogEntry; result?: ToolResult; loading: boolean; kind: string; favorite: boolean; onToggleFavorite: () => void }) {
  const Icon = TOOL_ICONS[tool.id] ?? FALLBACK_ICON;
  const v = result ? VERDICT[result.verdict] : null;
  const unavailable = result?.status === "unavailable";
  return (
    <Dialog>
      <Card className={cn("relative flex h-full flex-col gap-3 p-4 transition-colors", unavailable && "opacity-70")}>
        <button
          type="button"
          onClick={onToggleFavorite}
          className="absolute end-3 top-3 rounded p-1 text-muted-foreground hover:text-warning"
          aria-label={favorite ? `إزالة ${tool.nameAr} من المفضلة` : `إضافة ${tool.nameAr} إلى المفضلة`}
          aria-pressed={favorite}
        >
          <Star className={cn("h-4 w-4", favorite && "fill-warning text-warning")} />
        </button>
        <div className="flex items-start gap-3 pe-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{tool.nameAr}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground" dir="auto">
              {tool.descriptionAr}
            </p>
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10" />
          </div>
        ) : !result ? (
          <p className="text-xs text-muted-foreground">لا توجد نتيجة.</p>
        ) : unavailable ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {result.headline}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {v && (
                <Badge variant={v.variant}>
                  <v.icon className="h-3.5 w-3.5" aria-hidden />
                  {v.label}
                </Badge>
              )}
              {result.timeframe && <span className="text-[11px] text-muted-foreground">إطار {TIMEFRAME_LABELS[result.timeframe]}</span>}
            </div>
            <p className="text-sm leading-relaxed">{result.headline}</p>
            {result.metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {result.metrics.slice(0, 4).map((m) => (
                  <div key={m.label} className="rounded-md border bg-background/40 px-2 py-1.5">
                    <div className="text-[11px] text-muted-foreground">{m.label}</div>
                    <div className={cn("num truncate text-xs font-semibold", m.tone && TONE_TEXT[m.tone])} title={m.value}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DialogTrigger asChild>
              <button type="button" className="mt-auto self-start text-xs font-medium text-primary hover:underline">
                عرض التفاصيل والشرح
              </button>
            </DialogTrigger>
          </>
        )}
      </Card>
      {result && !unavailable && (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              {tool.nameAr}
            </DialogTitle>
            <DialogDescription dir="auto">
              {tool.nameEn} — {tool.descriptionAr}
            </DialogDescription>
          </DialogHeader>
          <ToolDetails result={result} kind={kind} />
        </DialogContent>
      )}
    </Dialog>
  );
}

export function ToolDetails({ result, kind }: { result: ToolResult; kind: string }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium leading-relaxed">{result.headline}</p>
      {result.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {result.metrics.map((m) => (
            <div key={m.label} className="rounded-md border p-2">
              <div className="text-[11px] text-muted-foreground">{m.label}</div>
              <div className={cn("num text-sm font-semibold", m.tone && TONE_TEXT[m.tone])}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
      {result.levels && result.levels.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">المستويات</h4>
          <ul className="space-y-1">
            {[...result.levels].sort((a, b) => b.price - a.price).map((l) => (
              <li key={`${l.label}-${l.price}`} className="flex justify-between gap-3 rounded-md border px-3 py-1.5">
                <span>{l.label}</span>
                <span className={cn("num font-semibold", l.tone && TONE_TEXT[l.tone])}>{formatAssetValue(l.price, kind)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.table && (
        <Table>
          <TableHeader>
            <TableRow>
              {result.table.columns.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.table.rows.map((r, i) => (
              <TableRow key={i}>
                {r.cells.map((cell, j) => (
                  <TableCell key={j} className={cn("whitespace-nowrap text-xs", j > 0 && r.tone && TONE_TEXT[r.tone])}>
                    <span className="num">{cell}</span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {result.details.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {result.details.map((d, i) => (
            <li key={i}>• {d}</li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">نتيجة آلية لأغراض تعليمية ومعلوماتية — ليست نصيحة مالية.</p>
    </div>
  );
}
