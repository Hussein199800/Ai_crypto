"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/formatters";

/** حاسبة حجم المركز: المخاطرة الثابتة من رأس المال ÷ المسافة إلى الوقف */
export function RiskCalculator({ defaults }: { defaults?: { entry?: number; stop?: number; target?: number } }) {
  const [capital, setCapital] = useState("1000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState(defaults?.entry ? String(+defaults.entry.toPrecision(6)) : "");
  const [stop, setStop] = useState(defaults?.stop ? String(+defaults.stop.toPrecision(6)) : "");
  const [target, setTarget] = useState(defaults?.target ? String(+defaults.target.toPrecision(6)) : "");

  const r = useMemo(() => {
    const c = Number(capital);
    const rp = Number(riskPct);
    const e = Number(entry);
    const s = Number(stop);
    const t = Number(target);
    if (!(c > 0 && rp > 0 && e > 0 && s > 0) || e === s) return null;
    const riskAmount = (c * rp) / 100;
    const perUnit = Math.abs(e - s);
    const qty = riskAmount / perUnit;
    const notional = qty * e;
    const long = e > s;
    const rr = t > 0 ? (long ? (t - e) / perUnit : (e - t) / perUnit) : null;
    return { riskAmount, qty, notional, leverage: notional / c, rr, stopPct: (perUnit / e) * 100, long };
  }, [capital, riskPct, entry, stop, target]);

  const field = (id: string, label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} type="number" inputMode="decimal" min="0" step="any" dir="ltr" value={value} onChange={(e) => set(e.target.value)} />
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );

  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Calculator className="h-4 w-4 text-primary" aria-hidden />
        حاسبة حجم المركز
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {field("rc-capital", "رأس المال", capital, setCapital)}
        {field("rc-risk", "المخاطرة %", riskPct, setRiskPct, "يُنصح 1–2%")}
        {field("rc-entry", "سعر الدخول", entry, setEntry)}
        {field("rc-stop", "وقف الخسارة", stop, setStop)}
        {field("rc-target", "الهدف (اختياري)", target, setTarget)}
      </div>
      {r ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <Out label="الاتجاه" value={r.long ? "شراء (Long)" : "بيع (Short)"} />
          <Out label="المبلغ المعرّض للخسارة" value={formatNumber(r.riskAmount, 2)} />
          <Out label="الكمية" value={formatNumber(r.qty, 6)} />
          <Out label="قيمة المركز" value={`${formatNumber(r.notional, 2)}${r.leverage > 1 ? ` (رافعة ${formatNumber(r.leverage, 1)}x)` : ""}`} warn={r.leverage > 1} />
          <Out label="العائد / المخاطرة" value={r.rr === null ? "—" : `${formatNumber(r.rr, 2)}R`} warn={r.rr !== null && r.rr < 1.5} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">أدخل رأس المال ونسبة المخاطرة وسعري الدخول والوقف لحساب حجم المركز.</p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">أداة حسابية تعليمية؛ لا تشمل الرسوم أو الانزلاق السعري، وليست نصيحة مالية.</p>
    </Card>
  );
}

function Out({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${warn ? "border-warning/50" : ""}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`num font-semibold ${warn ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}
