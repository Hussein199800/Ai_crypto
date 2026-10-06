import { DashboardView } from "@/components/dashboard/dashboard-view";
import { Disclaimer } from "@/components/common/disclaimer";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="panel panel-glow relative overflow-hidden p-5 sm:p-7">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">منصة تحليل العملات الرقمية بذكاء متعدد المؤشرات</h1>
          <p className="mt-2 text-muted-foreground sm:text-lg">حلّل اتجاه السوق، الزخم، السيولة، والمخاطر في لوحة واحدة.</p>
        </div>
      </section>
      <Disclaimer short />
      <DashboardView />
    </div>
  );
}
