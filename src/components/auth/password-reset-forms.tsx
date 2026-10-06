"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, Mail, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiClientError, apiSend, errorMessage } from "@/lib/client/fetcher";
import { fieldErrors, resetPasswordSchema } from "@/lib/validators";
import { AuthCard, FieldError } from "./auth-card";
import { PasswordStrength } from "./password-strength";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await apiSend<{ message: string }>("/api/auth/forgot-password", "POST", { email: email.trim() });
      setMsg({ ok: true, text: r.message });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthCard title="استعادة كلمة المرور" description="أدخل بريدك وسنرسل لك رابطًا لإعادة تعيين كلمة المرور." footer={<Link href="/login" className="text-primary hover:underline">العودة لتسجيل الدخول</Link>}>
      {msg && (
        <Alert variant={msg.ok ? "success" : "destructive"} className="mb-4">
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" dir="ltr" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Mail />}
          إرسال رابط الاستعادة
        </Button>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ token, ...form });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      if (fieldErrors(parsed.error).token) setMsg({ ok: false, text: "رابط الاستعادة غير صالح." });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const r = await apiSend<{ message: string }>("/api/auth/reset-password", "POST", { token, ...form });
      setMsg({ ok: true, text: r.message });
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setErrors(err.fields);
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }
  if (!token) {
    return (
      <AuthCard title="رابط غير صالح">
        <p className="text-sm text-muted-foreground">رابط إعادة التعيين ناقص أو غير صالح.</p>
        <Button asChild className="mt-4 w-full">
          <Link href="/forgot-password">طلب رابط جديد</Link>
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="تعيين كلمة مرور جديدة">
      {msg && (
        <Alert variant={msg.ok ? "success" : "destructive"} className="mb-4">
          <AlertDescription>
            {msg.text} {msg.ok && <Link href="/login" className="underline">تسجيل الدخول</Link>}
          </AlertDescription>
        </Alert>
      )}
      {!msg?.ok && (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="password">كلمة المرور الجديدة</Label>
            <Input id="password" type="password" dir="ltr" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} aria-invalid={Boolean(errors.password)} />
            <PasswordStrength password={form.password} />
            <FieldError message={errors.password} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
            <Input id="confirmPassword" type="password" dir="ltr" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} aria-invalid={Boolean(errors.confirmPassword)} />
            <FieldError message={errors.confirmPassword} />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
            حفظ كلمة المرور
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function VerifyEmailView() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; text: string }>({ status: "loading", text: "جارٍ تأكيد بريدك الإلكتروني..." });
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) {
      setState({ status: "error", text: "رابط التأكيد ناقص أو غير صالح." });
      return;
    }
    apiSend<{ message: string }>("/api/auth/verify-email", "POST", { token })
      .then((r) => setState({ status: "ok", text: r.message }))
      .catch((e) => setState({ status: "error", text: errorMessage(e) }));
  }, [token]);
  return (
    <AuthCard title="تأكيد البريد الإلكتروني">
      <div className="flex flex-col items-center gap-3 text-center">
        {state.status === "loading" ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : state.status === "ok" ? <CheckCircle2 className="h-8 w-8 text-positive" /> : <XCircle className="h-8 w-8 text-negative" />}
        <p className="text-sm">{state.text}</p>
        {state.status !== "loading" && (
          <Button asChild className="w-full">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
        )}
      </div>
    </AuthCard>
  );
}
