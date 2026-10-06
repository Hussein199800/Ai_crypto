"use client";

import { ErrorState } from "@/components/common/states";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState className="mt-10" message="حدث خطأ غير متوقع أثناء عرض الصفحة. حاول مرة أخرى." onRetry={reset} />;
}
