"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ASSETS } from "@/config/assets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiSend, errorMessage } from "@/lib/client/fetcher";
import { HORIZON_DESCRIPTIONS } from "@/lib/formatters/labels";
import type { Horizon, ReportRecord } from "@/types/analysis";
import { reportPath } from "@/lib/routes";

export function GenerateReportDialog({ defaultOpen = false, defaultSymbol }: { defaultOpen?: boolean; defaultSymbol?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState(defaultSymbol ?? "BTC");
  const [horizon, setHorizon] = useState<Horizon>("MEDIUM");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const { status } = useSession();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => setOpen(defaultOpen), [defaultOpen]);

  const options = useMemo(() => {
    const s = search.trim().toLowerCase();
    return ASSETS.filter((a) => !s || a.symbol.toLowerCase().includes(s) || a.display.toLowerCase().includes(s) || a.name.toLowerCase().includes(s) || a.nameAr.includes(search.trim()));
  }, [search]);

  const m = useMutation({
    mutationFn: () => apiSend<ReportRecord>("/api/reports/generate", "POST", { symbol, horizon, visibility }),
    onSuccess: (r) => {
      toast.success("تم إنشاء التقرير بنجاح");
      if (!r.persisted) toast.warning("تعذر حفظ التقرير في قاعدة البيانات — يُعرض مؤقتًا فقط.");
      qc.invalidateQueries({ queryKey: ["reports"] });
      setOpen(false);
      router.push(reportPath(r.symbol, r.id));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          إنشاء تقرير جديد
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إنشاء تقرير تحليلي جديد</DialogTitle>
          <DialogDescription>يجلب النظام آخر البيانات، ويحسب المؤشرات على 5 أطر زمنية، ويربطها بحالة السوق العام. النتيجة تقييم آلي وليست نصيحة مالية.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="asset-search">ابحث عن الأصل</Label>
            <Input id="asset-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="مثال: BTC أو إيثريوم أو BTC.D" autoComplete="off" />
            <Select aria-label="الأصل" value={symbol} onChange={(e) => setSymbol(e.target.value)} size={1}>
              {options.length === 0 && <option value="">لا نتائج</option>}
              {options.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.display} — {a.nameAr}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="horizon">الإطار الزمني للتحليل</Label>
            <Select id="horizon" value={horizon} onChange={(e) => setHorizon(e.target.value as Horizon)}>
              {(Object.keys(HORIZON_DESCRIPTIONS) as Horizon[]).map((h) => (
                <option key={h} value={h}>
                  {HORIZON_DESCRIPTIONS[h]}
                </option>
              ))}
            </Select>
          </div>
          {status === "authenticated" && (
            <div className="grid gap-2">
              <Label htmlFor="visibility">الخصوصية</Label>
              <Select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")}>
                <option value="public">عام — يظهر في قائمة التقارير</option>
                <option value="private">خاص — يظهر لك فقط</option>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={m.isPending || !symbol}>
              {m.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              {m.isPending ? "جارٍ التحليل..." : "إنشاء التقرير"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
