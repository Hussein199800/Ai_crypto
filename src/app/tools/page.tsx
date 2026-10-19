import { Suspense } from "react";
import type { Metadata } from "next";
import { ToolsWorkspace } from "@/components/tools/tools-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "أدوات التحليل" };

export default function ToolsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <ToolsWorkspace />
    </Suspense>
  );
}
