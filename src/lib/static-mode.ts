/**
 * النسخة الثابتة (GitHub Pages): تُبنى بـ NEXT_PUBLIC_STATIC_MODE=true.
 * لا يوجد خادم ولا قاعدة بيانات: التحليل يعمل في المتصفح، والبيانات تُجلب مباشرة من
 * واجهات عامة (CoinGecko / Binance / alternative.me)، والتقارير تُحفظ في المتصفح.
 */
export const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === "true";
