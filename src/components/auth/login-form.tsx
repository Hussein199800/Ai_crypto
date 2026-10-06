"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { safeCallbackUrl } from "@/lib/auth/policy";
import { apiSend, errorMessage } from "@/lib/client/fetcher";
import { AuthCard, FieldError } from "./auth-card";

const ERRORS: Record<string, string> = {
  INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  EMAIL_NOT_VERIFIED: "يرجى تأكيد بريدك الإلكتروني أولًا. تحقق من صندوق الوارد.",
  TOO_MANY_ATTEMPTS: "محاولات دخول كثيرة. انتظر 15 دقيقة ثم أعد المحاولة.",
  OAuthAccountNotLinked: "هذا البريد مسجل بطريقة دخول مختلفة. سجّل الدخول بالبريد وكلمة المرور.",
  AccessDenied: "تم رفض الوصول.",
  Configuration: "خطأ في إعدادات المصادقة على الخادم.",
  CredentialsSignin: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
};

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const callbackUrl = safeCallbackUrl(params.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? (ERRORS[params.get("error")!] ?? "تعذر تسجيل الدخول.") : null);
  const [unverified, setUnverified] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fe: typeof fieldErr = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fe.email = "صيغة البريد الإلكتروني غير صحيحة";
    if (!password) fe.password = "كلمة المرور مطلوبة";
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    setLoading(true);
    setError(null);
    setUnverified(false);
    const res = await signIn("credentials", { email: email.trim(), password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      const code = res?.error ?? "CredentialsSignin";
      setError(ERRORS[code] ?? "تعذر تسجيل الدخول.");
      setUnverified(code === "EMAIL_NOT_VERIFIED");
      return;
    }
    toast.success("تم تسجيل الدخول بنجاح");
    router.replace(callbackUrl);
    router.refresh();
  }

  async function resend() {
    try {
      const r = await apiSend<{ message: string }>("/api/auth/resend-verification", "POST", { email: email.trim() });
      toast.success(r.message);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <AuthCard
      title="تسجيل الدخول"
      description="ادخل إلى حسابك لحفظ المفضلة والتقارير الخاصة والتنبيهات."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/register" className="text-primary hover:underline">
            إنشاء حساب
          </Link>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {error}
            {unverified && (
              <button type="button" onClick={resend} className="ms-2 underline">
                إعادة إرسال رابط التأكيد
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(fieldErr.email)} aria-describedby="email-err" />
          <FieldError id="email-err" message={fieldErr.email} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">كلمة المرور</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              نسيت كلمة المرور؟
            </Link>
          </div>
          <Input id="password" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fieldErr.password)} aria-describedby="password-err" />
          <FieldError id="password-err" message={fieldErr.password} />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
          تسجيل الدخول
        </Button>
      </form>
      {googleEnabled && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            أو
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={() => signIn("google", { callbackUrl })}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            المتابعة باستخدام Google
          </Button>
        </>
      )}
    </AuthCard>
  );
}
