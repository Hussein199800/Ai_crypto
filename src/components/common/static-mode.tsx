"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Globe, ServerCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATIC_MODE } from "@/lib/static-mode";

/** شريط النسخة الثابتة (GitHub Pages) */
export function StaticBanner() {
  if (!STATIC_MODE) return null;
  return (
    <div role="status" className="no-print border-b border-info/40 bg-info/10 text-info">
      <div className="container flex items-center justify-center gap-2 py-1.5 text-center text-xs sm:text-sm">
        <Globe className="h-4 w-4 shrink-0" aria-hidden />
        نسخة ثابتة (GitHub Pages): التحليل يعمل في متصفحك ببيانات حية من مصادر عامة، والتقارير تُحفظ في هذا المتصفح فقط.
      </div>
    </div>
  );
}

/** بديل للميزات التي تتطلب خادمًا وقاعدة بيانات */
export function ServerOnlyNotice({ feature }: { feature: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
      <ServerCog className="h-9 w-9 text-info" aria-hidden />
      <h1 className="text-lg font-bold">{feature} غير متاح في النسخة الثابتة</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        هذه النسخة منشورة على GitHub Pages دون خادم أو قاعدة بيانات، لذلك تعمل التقارير والرسوم والمفضلة محليًا في متصفحك، بينما تتطلب الحسابات والتنبيهات نشر نسخة الخادم الكاملة (مثل Vercel مع PostgreSQL) كما هو موضح في ملف README.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/reports">التقارير</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/watchlist">المفضلة (محلية)</Link>
        </Button>
      </div>
    </div>
  );
}

/** يعيد المستخدم المسجل إلى مسار آخر (بديل التحقق على الخادم) */
export function RedirectIfAuthenticated({ to = "/" }: { to?: string }) {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated") router.replace(to);
  }, [status, router, to]);
  return null;
}

/** يحول الزائر لتسجيل الدخول (الوسيط والـ API يحميان المسار على الخادم أيضًا) */
export function RequireAuth({ callbackUrl, children }: { callbackUrl: string; children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "unauthenticated") router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }, [status, router, callbackUrl]);
  if (status !== "authenticated") return null;
  return <>{children}</>;
}
