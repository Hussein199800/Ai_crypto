"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/states";
import { apiGet, errorMessage } from "@/lib/client/fetcher";
import { HORIZON_LABELS, RECOMMENDATION_GROUPS, RISK_LABELS } from "@/lib/formatters/labels";
import type { ReportRecord } from "@/types/analysis";
import { GenerateReportDialog } from "./generate-report-dialog";
import { ReportCard } from "./report-card";

interface ListResponse {
  items: ReportRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const FILTER_KEYS = ["q", "recommendation", "risk", "horizon", "sort", "mine", "page"] as const;

export function ReportsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(params.get("q") ?? "");

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      next.delete("new");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // بحث مؤجل
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) setParam("q", q || null);
    }, 350);
    return () => clearTimeout(t);
  }, [q, params, setParam]);

  const query = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = params.get(k);
    if (v) query.set(k, v);
  }
  query.set("pageSize", "12");
  const qs = query.toString();

  const res = useQuery({
    queryKey: ["reports", qs],
    queryFn: () => apiGet<ListResponse>(`/api/reports?${qs}`),
    placeholderData: keepPreviousData,
  });
  const page = Number(params.get("page") ?? 1);
  const pages = res.data ? Math.max(1, Math.ceil(res.data.total / res.data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{params.get("mine") === "true" ? "تقاريري" : "التقارير"}</h1>
          <p className="text-sm text-muted-foreground">تقارير تحليلية آلية محفوظة — كل تقرير يعكس البيانات وقت إنشائه.</p>
        </div>
        <GenerateReportDialog defaultOpen={params.get("new") === "1"} />
      </div>

      <div className="panel grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم العملة أو الرمز" className="ps-9" aria-label="بحث" maxLength={40} />
        </div>
        <Select aria-label="التوصية" value={params.get("recommendation") ?? ""} onChange={(e) => setParam("recommendation", e.target.value || null)}>
          <option value="">كل الإشارات</option>
          {Object.entries(RECOMMENDATION_GROUPS).map(([k, g]) => (
            <option key={k} value={k}>
              {g.label}
            </option>
          ))}
        </Select>
        <Select aria-label="مستوى المخاطر" value={params.get("risk") ?? ""} onChange={(e) => setParam("risk", e.target.value || null)}>
          <option value="">كل مستويات المخاطر</option>
          {Object.entries(RISK_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              مخاطرة {l}
            </option>
          ))}
        </Select>
        <Select aria-label="الإطار الزمني" value={params.get("horizon") ?? ""} onChange={(e) => setParam("horizon", e.target.value || null)}>
          <option value="">كل الأطر الزمنية</option>
          {Object.entries(HORIZON_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l} المدى
            </option>
          ))}
        </Select>
        <Select aria-label="الترتيب" value={params.get("sort") ?? "newest"} onChange={(e) => setParam("sort", e.target.value)}>
          <option value="newest">أحدث تقرير</option>
          <option value="confidence">أعلى ثقة</option>
          <option value="score">أعلى درجة تحليل</option>
          <option value="change">أكبر تغير (24 ساعة)</option>
        </Select>
      </div>

      {res.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : res.isError ? (
        <ErrorState message={errorMessage(res.error)} onRetry={() => res.refetch()} />
      ) : !res.data?.items.length ? (
        <EmptyState icon={FileSearch} title="لا توجد تقارير مطابقة" description="جرّب تغيير معايير البحث أو أنشئ تقريرًا جديدًا." />
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            عدد النتائج: <span className="num">{res.data.total}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {res.data.items.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
          {pages > 1 && (
            <nav className="flex items-center justify-center gap-2" aria-label="الصفحات">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
                <ChevronRight />
                السابق
              </Button>
              <span className="num text-sm">
                {page} / {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>
                التالي
                <ChevronLeft />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
