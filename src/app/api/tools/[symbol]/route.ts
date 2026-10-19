import { handleApiError, jsonError, jsonOk, searchParamsObject } from "@/lib/api";
import { getMarketDataProvider } from "@/lib/providers";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { computeTools } from "@/lib/tools/run";
import { symbolSchema, toolsQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** تشغيل أدوات التحليل لأصل: ?timeframe=4h&tools=ma-consensus,ichimoku (افتراضيًا كل الأدوات) */
export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const rl = rateLimit(`tools:${clientIp(req.headers)}`, 60, 60_000);
    if (!rl.ok) return jsonError(429, "طلبات كثيرة، حاول بعد قليل", undefined, { "Retry-After": String(rl.retryAfterSec) });
    const symbol = symbolSchema.parse((await params).symbol);
    const q = toolsQuerySchema.parse(searchParamsObject(req.url));
    return jsonOk(await computeTools(getMarketDataProvider(), symbol, q.timeframe, q.tools));
  } catch (e) {
    return handleApiError(e, "api.tools");
  }
}
