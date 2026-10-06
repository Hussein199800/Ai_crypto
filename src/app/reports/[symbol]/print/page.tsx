import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { getReportById, getLatestReport } from "@/lib/services/reports";
import { normalizeSymbol } from "@/config/assets";
import { reportIdSchema } from "@/lib/validators";
import { PrintReport } from "@/components/reports/print-report";
import { HttpError } from "@/lib/api";

export const metadata: Metadata = { title: "تصدير التقرير PDF", robots: { index: false } };
export const dynamic = "force-dynamic";

/** نسخة قابلة للطباعة — تُحفظ PDF عبر نافذة الطباعة في المتصفح (يدعم العربية وRTL بالكامل) */
export default async function PrintPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ id?: string }> }) {
  const symbol = normalizeSymbol((await params).symbol);
  const { id } = await searchParams;
  const viewer = await getViewer();
  try {
    const record = id && reportIdSchema.safeParse(id).success ? await getReportById(id, viewer) : await getLatestReport(symbol, viewer);
    if (!record?.data || record.symbol !== symbol) notFound();
    return <PrintReport report={record.data} />;
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
}
