import type { ReportRecord } from "@/types/analysis";

/** حفظ التقارير في متصفح المستخدم (النسخة الثابتة لا تملك قاعدة بيانات) */
const KEY = "cryptoscope:reports:v1";
const MAX_REPORTS = 25;

export function readReports(): ReportRecord[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as ReportRecord[]).filter((r) => r && typeof r.id === "string" && r.data) : [];
  } catch {
    return [];
  }
}

/** يحفظ التقرير ويحذف الأقدم عند امتلاء التخزين */
export function saveReport(r: ReportRecord): boolean {
  let list = [r, ...readReports().filter((x) => x.id !== r.id)].slice(0, MAX_REPORTS);
  while (list.length > 0) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      list = list.slice(0, -1);
    }
  }
  return false;
}

export function newReportId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => (b % 36).toString(36)).join("");
  return `c${Date.now().toString(36)}${body}`.slice(0, 25);
}
