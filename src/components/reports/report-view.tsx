"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Loader2, RefreshCw, Star } from "lucide-react";
import { toast } from "sonner";
import { getAssetConfig } from "@/config/assets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Select } from "@/components/ui/select";
import { useWatchlist } from "@/hooks/use-watchlist";
import { ApiClientError, apiGet, apiSend, errorMessage } from "@/lib/client/fetcher";
import { HORIZON_DESCRIPTIONS } from "@/lib/formatters/labels";
import { formatRelative } from "@/lib/formatters";
import type { Horizon, ReportRecord } from "@/types/analysis";
import { ReportContent } from "./report-content";
import { reportPath, reportPrintPath } from "@/lib/routes";

export function ReportView({ symbol }: { symbol: string }) {
  const params = useSearchParams();
  const id = params.get("id");
  const router = useRouter();
  const qc = useQueryClient();
  const wl = useWatchlist();
  const cfg = getAssetConfig(symbol);
  const autoTriggered = useRef(false);

  const q = useQuery({
    queryKey: ["report", symbol, id],
    queryFn: async (): Promise<ReportRecord | null> => {
      if (id) return apiGet<ReportRecord>(`/api/reports/${encodeURIComponent(id)}`);
      const r = await apiGet<{ report: ReportRecord | null }>(`/api/reports/latest?symbol=${encodeURIComponent(symbol)}`);
      return r.report;
    },
  });

  const gen = useMutation({
    mutationFn: (horizon: Horizon) => apiSend<ReportRecord>("/api/reports/generate", "POST", { symbol, horizon, visibility: "public" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      if (r.id) {
        qc.setQueryData(["report", symbol, r.id], r);
        router.replace(reportPath(symbol, r.id), { scroll: false });
      } else {
        qc.setQueryData(["report", symbol, id], r);
        toast.warning("تعذر حفظ التقرير — يُعرض مؤقتًا فقط.");
      }
      toast.success("تم تحديث التحليل");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // إنشاء تقرير تلقائيًا عند عدم وجود تقرير سابق لهذا الأصل
  useEffect(() => {
    if (!id && q.isSuccess && q.data === null && !autoTriggered.current && !gen.isPending) {
      autoTriggered.current = true;
      gen.mutate("MEDIUM");
    }
  }, [id, q.isSuccess, q.data, gen]);

  if (!cfg) return <EmptyState title="الرمز غير مدعوم" description="تحقق من رمز العملة وحاول مرة أخرى." action={<Button asChild><Link href="/reports">العودة للتقارير</Link></Button>} />;
  if (q.isError) {
    const notFound = q.error instanceof ApiClientError && q.error.status === 404;
    return notFound ? (
      <EmptyState title="التقرير غير موجود" description="قد يكون التقرير خاصًا أو محذوفًا." action={<Button asChild><Link href={reportPath(symbol)}>عرض أحدث تقرير لـ {cfg.display}</Link></Button>} />
    ) : (
      <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
    );
  }
  if (q.isLoading || (gen.isPending && !q.data)) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {gen.isPending ? `جارٍ تحليل ${cfg.display}: جلب البيانات وحساب المؤشرات على 5 أطر زمنية...` : "جارٍ تحميل التقرير..."}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  const record = q.data;
  if (!record?.data) {
    return (
      <EmptyState
        title={`لا يوجد تقرير لـ ${cfg.display} بعد`}
        description={gen.isError ? errorMessage(gen.error) : "أنشئ تقريرًا جديدًا لعرض التحليل."}
        action={
          <Button onClick={() => gen.mutate("MEDIUM")} disabled={gen.isPending}>
            <RefreshCw />
            إنشاء تقرير
          </Button>
        }
      />
    );
  }
  const report = record.data;
  const ageHours = (Date.now() - new Date(record.createdAt).getTime()) / 3_600_000;

  const actions = (
    <>
      <Select aria-label="الأفق الزمني للتحديث" defaultValue={report.horizon} id="refresh-horizon" className="h-9 w-44 text-xs">
        {(Object.keys(HORIZON_DESCRIPTIONS) as Horizon[]).map((h) => (
          <option key={h} value={h}>
            {HORIZON_DESCRIPTIONS[h]}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        onClick={() => {
          const el = document.getElementById("refresh-horizon") as HTMLSelectElement | null;
          gen.mutate((el?.value as Horizon) ?? report.horizon);
        }}
        disabled={gen.isPending}
      >
        {gen.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        تحديث التحليل
      </Button>
      <Button size="sm" variant={wl.has(symbol) ? "secondary" : "outline"} onClick={() => wl.toggle(symbol)} aria-pressed={wl.has(symbol)}>
        <Star className={wl.has(symbol) ? "fill-warning text-warning" : ""} />
        {wl.has(symbol) ? "في المفضلة" : "إضافة إلى المفضلة"}
      </Button>
      {record.id && (
        <Button size="sm" variant="outline" asChild>
          <Link href={reportPrintPath(symbol, record.id)} target="_blank" rel="noopener">
            <FileDown />
            تصدير PDF
          </Link>
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-3">
      {ageHours > 6 && (
        <div role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          هذا التقرير أُنشئ {formatRelative(record.createdAt)} وقد لا يعكس حالة السوق الحالية. اضغط «تحديث التحليل» للحصول على تقييم جديد.
        </div>
      )}
      <ReportContent report={report} actions={actions} />
    </div>
  );
}
