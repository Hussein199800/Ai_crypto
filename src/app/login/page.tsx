import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getViewer } from "@/lib/auth/session";
import { isGoogleAuthEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  if (await getViewer()) redirect("/");
  return (
    <Suspense>
      <LoginForm googleEnabled={isGoogleAuthEnabled()} />
    </Suspense>
  );
}
