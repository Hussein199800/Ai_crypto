import { Suspense } from "react";
import type { Metadata } from "next";
import { ReportsView } from "@/components/reports/reports-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "التقارير" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ReportsView />
    </Suspense>
  );
}
