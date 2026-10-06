import { Suspense } from "react";
import type { Metadata } from "next";
import { getAssetConfig, normalizeSymbol } from "@/config/assets";
import { ReportView } from "@/components/reports/report-view";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const cfg = getAssetConfig((await params).symbol);
  return { title: cfg ? `تقرير ${cfg.display} — ${cfg.nameAr}` : "تقرير غير موجود" };
}

export default async function ReportPage({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = normalizeSymbol((await params).symbol);
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ReportView symbol={symbol} />
    </Suspense>
  );
}
