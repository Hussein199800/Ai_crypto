import type { Metadata } from "next";
import { AlertsView } from "@/components/alerts/alerts-view";
import { RequireAuth, ServerOnlyNotice } from "@/components/common/static-mode";
import { STATIC_MODE } from "@/lib/static-mode";

export const metadata: Metadata = { title: "التنبيهات" };

/** صفحة خاصة — محمية بالوسيط على الخادم، ومسارات الـ API تتحقق من الجلسة أيضًا */
export default function AlertsPage() {
  if (STATIC_MODE) return <ServerOnlyNotice feature="التنبيهات" />;
  return (
    <RequireAuth callbackUrl="/alerts">
      <AlertsView />
    </RequireAuth>
  );
}
