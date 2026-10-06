import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { RedirectIfAuthenticated, ServerOnlyNotice } from "@/components/common/static-mode";
import { STATIC_MODE } from "@/lib/static-mode";

export const metadata: Metadata = { title: "إنشاء حساب" };

export default function RegisterPage() {
  if (STATIC_MODE) return <ServerOnlyNotice feature="إنشاء الحساب" />;
  return (
    <>
      <RedirectIfAuthenticated />
      <RegisterForm />
    </>
  );
}
