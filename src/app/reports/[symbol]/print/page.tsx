import { Suspense } from "react";
import type { Metadata } from "next";
import { ASSETS, normalizeSymbol } from "@/config/assets";
import { PrintLoader } from "@/components/reports/print-loader";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "تصدير التقرير PDF", robots: { index: false } };

export function generateStaticParams() {
  return ASSETS.map((a) => ({ symbol: a.symbol }));
}

/** نسخة قابلة للطباعة — تُحفظ PDF عبر نافذة الطباعة في المتصفح (يدعم العربية وRTL بالكامل) */
export default async function PrintPage({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = normalizeSymbol((await params).symbol);
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PrintLoader symbol={symbol} />
    </Suspense>
  );
}
