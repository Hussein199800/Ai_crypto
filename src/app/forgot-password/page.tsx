import type { Metadata } from "next";
import { ServerOnlyNotice } from "@/components/common/static-mode";
import { STATIC_MODE } from "@/lib/static-mode";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "استعادة كلمة المرور" };

export default function ForgotPasswordPage() {
  if (STATIC_MODE) return <ServerOnlyNotice feature="استعادة كلمة المرور" />;
  return <ForgotPasswordForm />;
}
