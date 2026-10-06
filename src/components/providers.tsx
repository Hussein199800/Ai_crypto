"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiClientError } from "@/lib/client/fetcher";
import { STATIC_MODE } from "@/lib/static-mode";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => {
              // لا نعيد المحاولة لأخطاء العميل (4xx)
              if (err instanceof ApiClientError && err.status >= 400 && err.status < 500) return false;
              return count < 2;
            },
          },
        },
      }),
  );
  return (
    // في النسخة الثابتة لا يوجد خادم مصادقة: جلسة فارغة دون أي طلبات
    <SessionProvider {...(STATIC_MODE ? { session: null, refetchOnWindowFocus: false } : {})}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <QueryClientProvider client={client}>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster richColors position="top-center" dir="rtl" theme="system" toastOptions={{ style: { fontFamily: "inherit" } }} />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
