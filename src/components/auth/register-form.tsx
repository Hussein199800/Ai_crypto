"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiClientError, apiSend, errorMessage } from "@/lib/client/fetcher";
import { registerSchema, fieldErrors } from "@/lib/validators";
import { AuthCard, FieldError } from "./auth-card";
import { PasswordStrength } from "./password-strength";

export function RegisterForm() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const r = await apiSend<{ message: string }>("/api/auth/register", "POST", form);
      setDone(r.message);
      toast.success("تم إرسال طلب إنشاء الحساب");
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="تحقق من بريدك الإلكتروني">
        <Alert variant="success">
          <MailCheck />
          <AlertDescription>{done}</AlertDescription>
        </Alert>
        <Button asChild className="mt-4 w-full">
          <Link href="/login">الذهاب إلى تسجيل الدخول</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="إنشاء حساب"
      description="أنشئ حسابًا لحفظ المفضلة والتقارير الخاصة والتنبيهات."
      footer={
        <>
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="text-primary hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="name">الاسم</Label>
          <Input id="name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} maxLength={60} />
          <FieldError message={errors.name} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" dir="ltr" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} aria-invalid={Boolean(errors.email)} />
          <FieldError message={errors.email} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input id="password" type="password" dir="ltr" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} aria-invalid={Boolean(errors.password)} />
          <PasswordStrength password={form.password} />
          <FieldError message={errors.password} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
          <Input id="confirmPassword" type="password" dir="ltr" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} aria-invalid={Boolean(errors.confirmPassword)} />
          <FieldError message={errors.confirmPassword} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-start gap-2">
            <Checkbox id="terms" checked={form.acceptTerms} onCheckedChange={(v) => set("acceptTerms", v === true)} aria-invalid={Boolean(errors.acceptTerms)} className="mt-0.5" />
            <Label htmlFor="terms" className="text-sm font-normal leading-relaxed">
              أوافق على{" "}
              <Link href="/about#terms" target="_blank" className="text-primary hover:underline">
                شروط الاستخدام
              </Link>{" "}
              و
              <Link href="/about#privacy" target="_blank" className="text-primary hover:underline">
                سياسة الخصوصية
              </Link>
              ، وأدرك أن المنصة لا تقدم نصيحة مالية.
            </Label>
          </div>
          <FieldError message={errors.acceptTerms} />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <UserPlus />}
          إنشاء الحساب
        </Button>
      </form>
    </AuthCard>
  );
}
