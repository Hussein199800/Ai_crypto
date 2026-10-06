"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellPlus, BellRing, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ASSETS, getAssetConfig } from "@/config/assets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/states";
import { SectionTitle } from "@/components/common/section-title";
import { ALERT_TYPE_LABELS, DEFAULT_THRESHOLDS, type AlertType } from "@/lib/alerts/evaluate";
import { apiGet, apiSend, errorMessage } from "@/lib/client/fetcher";
import { formatDateTime } from "@/lib/formatters";

interface AlertRow {
  id: string;
  symbol: string;
  type: AlertType;
  threshold: number | null;
  cooldownMinutes: number;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}
interface EventRow {
  id: string;
  message: string;
  createdAt: string;
}

const THRESHOLD_HINT: Partial<Record<AlertType, string>> = {
  PRICE_MOVE: "نسبة التغير خلال 24 ساعة (%)",
  SUPPORT_BREAK: "سعر الدعم (اتركه فارغًا لاستخدام الدعم الآلي)",
  RESISTANCE_BREAK: "سعر المقاومة (اتركه فارغًا لاستخدام المقاومة الآلية)",
  BTC_D_CHANGE: "التغير بالنقاط المئوية خلال 24 ساعة",
  USDT_D_RISE: "الارتفاع بالنقاط المئوية خلال 24 ساعة",
};

export function AlertsView() {
  const qc = useQueryClient();
  const [form, setForm] = useState<{ symbol: string; type: AlertType; threshold: string; cooldownMinutes: string }>({ symbol: "BTC", type: "PRICE_MOVE", threshold: "", cooldownMinutes: "240" });
  const q = useQuery({ queryKey: ["alerts"], queryFn: () => apiGet<{ alerts: AlertRow[]; events: EventRow[] }>("/api/alerts") });
  const create = useMutation({
    mutationFn: () =>
      apiSend("/api/alerts", "POST", {
        symbol: form.symbol,
        type: form.type,
        threshold: form.threshold ? Number(form.threshold) : undefined,
        cooldownMinutes: Number(form.cooldownMinutes),
      }),
    onSuccess: () => {
      toast.success("تم إنشاء التنبيه");
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiSend(`/api/alerts/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("تم حذف التنبيه");
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const needsSymbol = !["BTC_D_CHANGE", "USDT_D_RISE"].includes(form.type);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">التنبيهات</h1>
        <p className="text-sm text-muted-foreground">تنبيهات اختيارية بعتبات محافظة وفترة تهدئة لمنع التكرار. تُقيَّم دوريًا عبر المهمة المجدولة.</p>
      </div>
      <Card className="p-4">
        <SectionTitle title="تنبيه جديد" icon={BellPlus} />
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="type">نوع التنبيه</Label>
            <Select id="type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AlertType, symbol: ["BTC_D_CHANGE"].includes(e.target.value) ? "BTC.D" : e.target.value === "USDT_D_RISE" ? "USDT.D" : f.symbol }))}>
              {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map((t) => (
                <option key={t} value={t}>
                  {ALERT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="symbol">الأصل</Label>
            <Select id="symbol" value={form.symbol} onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))} disabled={!needsSymbol}>
              {ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.display}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="threshold">العتبة</Label>
            <Input id="threshold" type="number" step="any" min="0" dir="ltr" value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} placeholder={DEFAULT_THRESHOLDS[form.type] != null ? `افتراضي ${DEFAULT_THRESHOLDS[form.type]}` : "اختياري"} />
            {THRESHOLD_HINT[form.type] && <p className="text-[11px] text-muted-foreground">{THRESHOLD_HINT[form.type]}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cooldown">فترة التهدئة</Label>
            <Select id="cooldown" value={form.cooldownMinutes} onChange={(e) => setForm((f) => ({ ...f, cooldownMinutes: e.target.value }))}>
              <option value="60">ساعة</option>
              <option value="240">4 ساعات</option>
              <option value="720">12 ساعة</option>
              <option value="1440">يوم</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <BellPlus />}
              إنشاء
            </Button>
          </div>
        </form>
      </Card>

      {q.isLoading ? (
        <Skeleton className="h-48" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionTitle title="تنبيهاتي" icon={BellRing} />
            {q.data!.alerts.length === 0 ? (
              <EmptyState title="لا توجد تنبيهات" description="أنشئ تنبيهًا لمتابعة التغيرات المهمة." />
            ) : (
              <Card className="divide-y">
                {q.data!.alerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <div className="text-sm font-medium">
                        {ALERT_TYPE_LABELS[a.type]} — {getAssetConfig(a.symbol)?.display ?? a.symbol}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        العتبة: <span className="num">{a.threshold ?? DEFAULT_THRESHOLDS[a.type] ?? "آلي"}</span> · التهدئة: <span className="num">{a.cooldownMinutes}</span> دقيقة · آخر إطلاق: {a.lastTriggeredAt ? formatDateTime(a.lastTriggeredAt) : "لم يُطلق بعد"}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)} aria-label="حذف التنبيه">
                      <Trash2 className="text-negative" />
                    </Button>
                  </div>
                ))}
              </Card>
            )}
          </section>
          <section>
            <SectionTitle title="آخر التنبيهات المُطلقة" icon={BellRing} />
            {q.data!.events.length === 0 ? (
              <EmptyState title="لا توجد أحداث بعد" />
            ) : (
              <Card className="divide-y">
                {q.data!.events.map((e) => (
                  <div key={e.id} className="p-3">
                    <p className="text-sm">{e.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
