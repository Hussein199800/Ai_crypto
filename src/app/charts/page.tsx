import { Suspense } from "react";
import type { Metadata } from "next";
import { ChartWorkspace } from "@/components/charts/chart-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "الرسوم البيانية" };

export default function ChartsPage() {
  const tradingViewConfigured = Boolean(getEnv().TRADINGVIEW_API_KEY);
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <ChartWorkspace tradingViewConfigured={tradingViewConfigured} />
    </Suspense>
  );
}
