import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertsView } from "@/components/alerts/alerts-view";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "التنبيهات" };

/** صفحة خاصة — محمية بالوسيط، ومع تحقق إضافي على الخادم */
export default async function AlertsPage() {
  if (!(await getViewer())) redirect("/login?callbackUrl=/alerts");
  return <AlertsView />;
}
