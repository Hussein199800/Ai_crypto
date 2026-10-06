import { Suspense } from "react";
import type { Metadata } from "next";
import { ServerOnlyNotice } from "@/components/common/static-mode";
import { STATIC_MODE } from "@/lib/static-mode";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "تعيين كلمة مرور جديدة", robots: { index: false } };

export default function ResetPasswordPage() {
  if (STATIC_MODE) return <ServerOnlyNotice feature="إعادة تعيين كلمة المرور" />;
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
