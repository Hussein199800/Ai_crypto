import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MockBanner } from "@/components/layout/mock-banner";
import { StaticBanner } from "@/components/common/static-mode";
import { isMockMode } from "@/lib/env";

export const metadata: Metadata = {
  title: { default: "CryptoScope AI — تحليل العملات الرقمية", template: "%s | CryptoScope AI" },
  description: "منصة تحليل العملات الرقمية بذكاء متعدد المؤشرات: الاتجاه، الزخم، السيولة، والمخاطر في لوحة واحدة. تحليل آلي وليس نصيحة مالية.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#061512",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // وضع Mock يُعطَّل دائمًا في الإنتاج (البناء والتشغيل)، لذا لا يتأثر بالتوليد المسبق للصفحات
  const mock = isMockMode();
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>
          {mock && <MockBanner />}
          <StaticBanner />
          <SiteHeader />
          <main className="container py-6">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
