import { FlaskConical } from "lucide-react";

/** شريط وضع البيانات التجريبية — يظهر أعلى التطبيق دائمًا عند تفعيل DATA_MODE=mock */
export function MockBanner() {
  return (
    <div role="status" className="no-print border-b border-warning/40 bg-warning/15 text-warning">
      <div className="container flex items-center justify-center gap-2 py-1.5 text-center text-xs font-medium sm:text-sm">
        <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
        وضع تجريبي - البيانات المعروضة غير لحظية
      </div>
    </div>
  );
}
