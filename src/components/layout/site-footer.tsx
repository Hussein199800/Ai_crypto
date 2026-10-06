import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="no-print mt-12 border-t">
      <div className="container flex flex-col gap-4 py-6 text-xs text-muted-foreground">
        <p className="flex items-start gap-2 leading-relaxed">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          جميع النتائج تحليل آلي وإشارات تحليلية لأغراض تعليمية ومعلوماتية فقط، وليست نصيحة مالية أو استشارة استثمارية مرخّصة. تداول العملات الرقمية ينطوي على مخاطر عالية.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span dir="ltr">© {new Date().getFullYear()} CryptoScope AI</span>
          <nav className="flex flex-wrap gap-4" aria-label="روابط التذييل">
            <Link href="/about#risk" className="hover:text-foreground">تنبيه المخاطر</Link>
            <Link href="/about#privacy" className="hover:text-foreground">سياسة الخصوصية</Link>
            <Link href="/about#terms" className="hover:text-foreground">شروط الاستخدام</Link>
            <Link href="/about#sources" className="hover:text-foreground">مصادر البيانات</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
