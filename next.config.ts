import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// سياسة أمان المحتوى: لا سكربتات خارجية، ولا اتصالات من المتصفح إلا للخادم نفسه.
// جميع طلبات مزودي البيانات تتم من الخادم فقط، لذا لا تُكشف المفاتيح للعميل.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://assets.coingecko.com https://coin-images.coingecko.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
].join("; ");

/**
 * النسخة الثابتة لـ GitHub Pages: NEXT_PUBLIC_STATIC_MODE=true و NEXT_PUBLIC_BASE_PATH=/اسم-المستودع
 * (انظر scripts/build-pages.mjs). لا خادم ولا ترويسات مخصصة في هذا الوضع.
 */
const isStatic = process.env.NEXT_PUBLIC_STATIC_MODE === "true";
const basePath = isStatic ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "") : "";

const staticConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

const nextConfig: NextConfig = isStatic ? staticConfig : {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
