import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { RedirectIfAuthenticated, ServerOnlyNotice } from "@/components/common/static-mode";
import { isGoogleAuthEnabled } from "@/lib/env";
import { STATIC_MODE } from "@/lib/static-mode";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  if (STATIC_MODE) return <ServerOnlyNotice feature="تسجيل الدخول" />;
  return (
    <Suspense>
      <RedirectIfAuthenticated />
      <LoginForm googleEnabled={isGoogleAuthEnabled()} />
    </Suspense>
  );
}
