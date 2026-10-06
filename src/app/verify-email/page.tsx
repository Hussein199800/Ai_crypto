import { Suspense } from "react";
import type { Metadata } from "next";
import { ServerOnlyNotice } from "@/components/common/static-mode";
import { STATIC_MODE } from "@/lib/static-mode";
import { VerifyEmailView } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "تأكيد البريد الإلكتروني", robots: { index: false } };

export default function VerifyEmailPage() {
  if (STATIC_MODE) return <ServerOnlyNotice feature="تأكيد البريد الإلكتروني" />;
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
