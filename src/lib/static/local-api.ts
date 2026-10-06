import { z, ZodError } from "zod";
import { ASSETS, getAssetConfig } from "@/config/assets";
import { fetchAndAnalyze } from "@/lib/analysis/build-report";
import { buildChartData } from "@/lib/analysis/chart-data";
import { buildDashboardData, type ScoreSummary } from "@/lib/analysis/dashboard";
import { HttpError } from "@/lib/errors";
import { RECOMMENDATION_GROUPS } from "@/lib/formatters/labels";
import { ProviderError, UnknownSymbolError } from "@/lib/providers/errors";
import { LiveProvider } from "@/lib/providers/live";
import { rateLimit } from "@/lib/security/rate-limit";
import { chartQuerySchema, firstError, generateReportSchema, reportsQuerySchema, symbolSchema } from "@/lib/validators";
import type { ReportRecord } from "@/types/analysis";
import type { MarketDataProvider } from "@/types/market";
import { BrowserSnapshotStore } from "./browser-snapshots";
import { newReportId, readReports, saveReport } from "./report-store";

/**
 * واجهة API محلية تعمل داخل المتصفح للنسخة الثابتة (GitHub Pages).
 * تحاكي مسارات /api/* التي تستخدمها الواجهة، دون خادم أو قاعدة بيانات.
 */
let provider: MarketDataProvider | null = null;
function getProvider() {
  provider ??= new LiveProvider({ snapshots: new BrowserSnapshotStore() });
  return provider;
}

export class LocalApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function scoresFor(symbols: string[]): Record<string, ScoreSummary> {
  const out: Record<string, ScoreSummary> = {};
  for (const r of readReports()) {
    if (!symbols.includes(r.symbol) || out[r.symbol] || !r.id) continue;
    out[r.symbol] = { id: r.id, score: r.score, recommendation: r.recommendation, createdAt: r.createdAt };
  }
  return out;
}

const withoutData = (r: ReportRecord): ReportRecord => ({ ...r, data: undefined });

async function handle(method: string, url: string, body?: unknown): Promise<unknown> {
  const u = new URL(url, "http://local");
  const path = u.pathname.replace(/\/+$/, "");
  const q = Object.fromEntries(u.searchParams.entries());
  const seg = path.split("/").filter(Boolean); // ["api", ...]

  if (method === "GET" && path === "/api/market/overview") {
    return buildDashboardData(getProvider(), async (symbols) => scoresFor(symbols));
  }
  if (method === "GET" && path === "/api/market/global") return getProvider().getGlobalMarketData();
  if (method === "GET" && path === "/api/market/dominance") return getProvider().getDominanceData();
  if (method === "GET" && path === "/api/market/fear-greed") return getProvider().getFearGreedIndex();
  if (method === "GET" && path === "/api/market/news") return getProvider().getMarketNews();

  if (method === "GET" && path === "/api/assets") {
    const symbols = q.symbols
      ? z.array(symbolSchema).max(50).parse(q.symbols.split(",").filter(Boolean))
      : ASSETS.filter((a) => a.kind === "CRYPTO" || a.kind === "STABLECOIN").map((a) => a.symbol);
    const p = getProvider();
    const overviews = p.getAssetsOverview ? await p.getAssetsOverview(symbols) : [];
    const scores = scoresFor(symbols);
    return { assets: overviews.map((o) => ({ ...o, analysis: scores[o.symbol] ?? null })) };
  }
  if (method === "GET" && seg[1] === "assets" && seg[2]) {
    return getProvider().getAssetOverview(symbolSchema.parse(decodeURIComponent(seg[2])));
  }

  if (method === "GET" && seg[1] === "charts" && seg[2]) {
    const symbol = symbolSchema.parse(decodeURIComponent(seg[2]));
    const cq = chartQuerySchema.parse(q);
    return buildChartData(getProvider(), symbol, cq.timeframe, cq.limit);
  }

  if (method === "GET" && path === "/api/reports") {
    const rq = reportsQuerySchema.parse(q);
    let list = readReports();
    if (rq.mine === "true") list = [];
    if (rq.q) {
      const needle = rq.q.toLowerCase();
      list = list.filter((r) => {
        const cfg = getAssetConfig(r.symbol);
        return r.symbol.toLowerCase().includes(needle.replace("/", "")) || r.assetName.toLowerCase().includes(needle) || (cfg?.nameAr ?? "").includes(rq.q!);
      });
    }
    if (rq.recommendation) list = list.filter((r) => RECOMMENDATION_GROUPS[rq.recommendation!].values.includes(r.recommendation));
    if (rq.risk) list = list.filter((r) => r.riskLevel === rq.risk);
    if (rq.horizon) list = list.filter((r) => r.horizon === rq.horizon);
    const byDate = (a: ReportRecord, b: ReportRecord) => b.createdAt.localeCompare(a.createdAt);
    list.sort(
      rq.sort === "confidence"
        ? (a, b) => b.confidence - a.confidence || byDate(a, b)
        : rq.sort === "score"
          ? (a, b) => b.score - a.score || byDate(a, b)
          : rq.sort === "change"
            ? (a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity)
            : byDate,
    );
    const start = (rq.page - 1) * rq.pageSize;
    return { items: list.slice(start, start + rq.pageSize).map(withoutData), total: list.length, page: rq.page, pageSize: rq.pageSize };
  }
  if (method === "GET" && path === "/api/reports/latest") {
    const symbol = symbolSchema.parse(q.symbol);
    const report = readReports().find((r) => r.symbol === symbol && (!q.horizon || r.horizon === q.horizon)) ?? null;
    return { report };
  }
  if (method === "POST" && path === "/api/reports/generate") {
    const rl = rateLimit("static:generate", 4, 60_000);
    if (!rl.ok) throw new LocalApiError(`طلبات متتالية كثيرة لحماية حدود مزودي البيانات المجانية. انتظر ${rl.retryAfterSec} ثانية.`, 429);
    const input = generateReportSchema.parse(body ?? {});
    const { report } = await fetchAndAnalyze(getProvider(), input.symbol, input.horizon);
    const record: ReportRecord = {
      id: newReportId(),
      symbol: report.symbol,
      assetName: report.name,
      userId: null,
      isPublic: true,
      horizon: report.horizon,
      recommendation: report.scoring.recommendation,
      riskLevel: report.risk.level,
      rawScore: report.scoring.rawScore,
      score: report.scoring.adjustedScore,
      confidence: report.scoring.confidence,
      dataQuality: report.dataQuality.score,
      priceAtAnalysis: report.overview.price,
      change24h: report.overview.change24h,
      isMock: report.isMock,
      createdAt: report.generatedAt,
      persisted: true,
      isOwner: true,
      data: report,
    };
    record.persisted = saveReport(record);
    if (!record.persisted) record.id = null;
    return record;
  }
  if (method === "GET" && seg[1] === "reports" && seg[2]) {
    const r = readReports().find((x) => x.id === decodeURIComponent(seg[2]));
    if (!r) throw new LocalApiError("التقرير غير موجود في هذا المتصفح", 404);
    return r;
  }

  if (path.startsWith("/api/watchlist") || path.startsWith("/api/alerts") || path.startsWith("/api/auth")) {
    throw new LocalApiError("هذه الميزة تتطلب نسخة الخادم (تسجيل الدخول وقاعدة البيانات) وغير متاحة في النسخة الثابتة", 501);
  }
  throw new LocalApiError("المسار غير متاح في النسخة الثابتة", 404);
}

/** تنفيذ طلب محلي مع تحويل الأخطاء إلى رسائل عربية */
export async function localRequest(method: string, url: string, body?: unknown): Promise<unknown> {
  try {
    return await handle(method, url, body);
  } catch (e) {
    if (e instanceof LocalApiError) throw e;
    if (e instanceof HttpError) throw new LocalApiError(e.message, e.status);
    if (e instanceof ZodError) throw new LocalApiError(firstError(e), 400);
    if (e instanceof UnknownSymbolError) throw new LocalApiError("الرمز غير مدعوم", 404);
    if (e instanceof ProviderError) {
      throw new LocalApiError("تعذر جلب البيانات من مزودي البيانات العامة (CoinGecko / Binance). قد تكون حدود الطلبات المجانية تجاوزت أو أن الاتصال محجوب. حاول بعد دقيقة.", 503);
    }
    throw new LocalApiError("حدث خطأ غير متوقع. حاول مرة أخرى.", 500);
  }
}
