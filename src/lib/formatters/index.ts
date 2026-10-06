export * from "./labels";

const DATE_LOCALE = "ar-EG-u-nu-latn-ca-gregory";

/** تنسيق السعر بعدد خانات مناسب لقيمته */
export function formatPrice(v: number | null | undefined, opts: { currency?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "غير متاح";
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  const s = v.toLocaleString("en-US", { minimumFractionDigits: abs >= 1000 ? 2 : Math.min(2, digits), maximumFractionDigits: digits });
  return opts.currency === false ? s : `$${s}`;
}

/** تنسيق الأرقام الكبيرة: 1.2T، 305.1M ... */
export function formatCompact(v: number | null | undefined, opts: { currency?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "غير متاح";
  const abs = Math.abs(v);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  let out = v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  for (const [size, suffix] of units) {
    if (abs >= size) {
      out = `${(v / size).toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
      break;
    }
  }
  return opts.currency === false ? out : `$${out}`;
}

export function formatPercent(v: number | null | undefined, opts: { sign?: boolean; digits?: number } = {}): string {
  if (v == null || !Number.isFinite(v)) return "غير متاح";
  const digits = opts.digits ?? 2;
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = opts.sign === false ? (v < 0 ? "-" : "") : v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${s}%`;
}

export function formatNumber(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "غير متاح";
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatDateTime(iso: string | number | Date | null | undefined): string {
  if (iso == null) return "غير متاح";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "غير متاح";
  return d.toLocaleString(DATE_LOCALE, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string | number | Date | null | undefined): string {
  if (iso == null) return "غير متاح";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "غير متاح";
  return d.toLocaleDateString(DATE_LOCALE, { year: "numeric", month: "short", day: "numeric" });
}

/** "منذ 5 دقائق" */
export function formatRelative(iso: string | number | Date | null | undefined, now = Date.now()): string {
  if (iso == null) return "غير متاح";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "غير متاح";
  const diff = Math.max(0, Math.round((now - t) / 1000));
  if (diff < 60) return "الآن";
  const m = Math.round(diff / 60);
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.round(h / 24);
  return `منذ ${d} يوم`;
}

/** قيمة مؤشر بحسب نوع الأصل (نسبة هيمنة أو قيمة سوقية أو سعر) */
export function formatAssetValue(v: number | null | undefined, kind: string): string {
  if (kind === "DOMINANCE") return v == null ? "غير متاح" : `${formatNumber(v, 2)}%`;
  if (kind === "INDEX") return formatCompact(v);
  if (kind === "PAIR") return v == null ? "غير متاح" : `${formatNumber(v, 6)} BTC`;
  return formatPrice(v);
}
