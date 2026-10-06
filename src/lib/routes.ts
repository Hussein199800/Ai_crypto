import { STATIC_MODE } from "@/lib/static-mode";

/**
 * روابط التقارير. في النسخة الثابتة تُضاف "/" في النهاية لأن رموزًا مثل BTC.D
 * تحتوي نقطة يعاملها Next.js كامتداد ملف فلا يضيف الشرطة تلقائيًا.
 */
const slash = STATIC_MODE ? "/" : "";

export function reportPath(symbol: string, id?: string | null): string {
  const base = `/reports/${encodeURIComponent(symbol)}${slash}`;
  return id ? `${base}?id=${encodeURIComponent(id)}` : base;
}

export function reportPrintPath(symbol: string, id?: string | null): string {
  const base = `/reports/${encodeURIComponent(symbol)}/print${slash}`;
  return id ? `${base}?id=${encodeURIComponent(id)}` : base;
}
