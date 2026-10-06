import { Prisma, type AnalysisReport } from "@prisma/client";
import { getAssetConfig } from "@/config/assets";
import { HttpError } from "@/lib/api";
import { canViewReport, type Viewer } from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { RECOMMENDATION_GROUPS } from "@/lib/formatters/labels";
import { logError } from "@/lib/logger";
import { getMarketDataProvider } from "@/lib/providers";
import { runAnalysis } from "@/lib/analysis/engine";
import type { ComputedIndicators } from "@/lib/analysis/timeframe";
import type { GenerateReportInput, ReportsQuery } from "@/lib/validators";
import type { AnalysisReportData, Horizon, ReportRecord } from "@/types/analysis";
import { TIMEFRAMES, type OHLCVSeries, type Timeframe } from "@/types/market";

const isProd = () => getEnv().NODE_ENV === "production";

/**
 * توليد تقرير جديد:
 * 1) جلب آخر بيانات السوق ← 2) التحقق من اكتمالها ← 3-7) حساب المؤشرات والأطر والسوق العام والدرجة والثقة
 * ← 8) السيناريوهات ← 9) الحفظ ← 10) الإرجاع مع وقت الإنشاء.
 */
export async function generateReport(input: GenerateReportInput, viewer: Viewer | null): Promise<ReportRecord> {
  const cfg = getAssetConfig(input.symbol);
  if (!cfg) throw new HttpError(404, "الرمز غير مدعوم");
  if (input.visibility === "private" && !viewer) throw new HttpError(401, "يجب تسجيل الدخول لإنشاء تقرير خاص");

  const provider = getMarketDataProvider();
  const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch((e) => (logError(`report.fetch.${cfg.symbol}`, e), null));

  // 1) جلب البيانات بالتوازي — فشل مصدر لا يوقف التقرير بل يخفض جودة البيانات
  const [overview, global, dominance, fearGreed, news, ...seriesList] = await Promise.all([
    safe(provider.getAssetOverview(cfg.symbol)),
    safe(provider.getGlobalMarketData()),
    safe(provider.getDominanceData()),
    safe(provider.getFearGreedIndex()),
    safe(provider.getMarketNews()),
    ...TIMEFRAMES.map((tf) => safe(provider.getOHLCV(cfg.symbol, tf))),
  ]);
  if (!overview) throw new HttpError(503, "تعذر جلب بيانات الأصل من مزودي البيانات حاليًا. حاول لاحقًا.");

  const series: Partial<Record<Timeframe, OHLCVSeries | null>> = {};
  TIMEFRAMES.forEach((tf, i) => (series[tf] = seriesList[i] as OHLCVSeries | null));

  const daily = async (sym: string) =>
    sym === cfg.symbol ? (series["1d"]?.candles ?? null) : ((await safe(provider.getOHLCV(sym, "1d")))?.candles ?? null);
  const [btcDaily, ethDaily, ethBtcDaily] = await Promise.all([daily("BTC"), daily("ETH"), daily("ETHBTC")]);

  // 2-8) التحليل (دالة نقية)
  const { report, computed } = runAnalysis({
    symbol: cfg.symbol,
    horizon: input.horizon,
    overview,
    series,
    global,
    dominance,
    fearGreed,
    news,
    btcDaily,
    ethDaily,
    ethBtcDaily,
  });

  // 9) الحفظ
  const isPublic = input.visibility !== "private";
  try {
    const saved = await persistReport(report, computed, viewer?.id ?? null, isPublic, series);
    return toRecord(saved, viewer, true);
  } catch (e) {
    logError("report.persist", e);
    return {
      id: null,
      symbol: report.symbol,
      assetName: report.name,
      userId: viewer?.id ?? null,
      isPublic,
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
      persisted: false,
      isOwner: Boolean(viewer),
      data: report,
    };
  }
}

async function persistReport(
  report: AnalysisReportData,
  computed: Partial<Record<Timeframe, ComputedIndicators>>,
  userId: string | null,
  isPublic: boolean,
  series: Partial<Record<Timeframe, OHLCVSeries | null>>,
) {
  const cfg = getAssetConfig(report.symbol)!;
  await prisma.asset.upsert({
    where: { symbol: cfg.symbol },
    update: {},
    create: { symbol: cfg.symbol, name: cfg.name, nameAr: cfg.nameAr, kind: cfg.kind, coingeckoId: cfg.coingeckoId, binanceSymbol: cfg.binanceSymbol },
  });
  const saved = await prisma.analysisReport.create({
    data: {
      symbol: report.symbol,
      assetName: report.name,
      userId,
      isPublic,
      horizon: report.horizon,
      recommendation: report.scoring.recommendation,
      riskLevel: report.risk.level,
      rawScore: report.scoring.rawScore,
      score: report.scoring.adjustedScore,
      confidence: report.scoring.confidence,
      dataQuality: report.dataQuality.score,
      positiveCount: report.scoring.counts.positive,
      negativeCount: report.scoring.counts.negative,
      neutralCount: report.scoring.counts.neutral,
      priceAtAnalysis: report.overview.price,
      change24h: report.overview.change24h,
      isMock: report.isMock,
      sources: report.sources,
      data: report as unknown as Prisma.InputJsonValue,
      indicators: {
        create: (Object.entries(computed) as [Timeframe, ComputedIndicators][]).map(([tf, c]) => ({
          symbol: report.symbol,
          timeframe: tf,
          values: snapshotValues(c) as Prisma.InputJsonValue,
        })),
      },
    },
  });
  // حفظ الشموع اليومية والأسبوعية الحقيقية كأرشيف (لا تُحفظ البيانات التجريبية)
  if (!report.isMock) {
    for (const tf of ["1d", "1w"] as Timeframe[]) {
      const s = series[tf];
      if (!s || s.meta.isMock || s.candles.length === 0) continue;
      await prisma.oHLCV
        .createMany({
          data: s.candles.slice(-300).map((c) => ({
            symbol: report.symbol,
            timeframe: tf,
            time: new Date(c.time),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            source: s.meta.source,
          })),
          skipDuplicates: true,
        })
        .catch((e) => logError("ohlcv.persist", e));
    }
  }
  return saved;
}

function snapshotValues(c: ComputedIndicators) {
  const { supports, resistances, pivots, fib, divergence, ...rest } = c;
  return {
    ...rest,
    supports: supports.slice(0, 3).map((s) => s.price),
    resistances: resistances.slice(0, 3).map((s) => s.price),
    fib: fib?.levels ?? null,
    divergence: divergence.type,
    pivots: pivots.length,
  };
}

export function toRecord(r: AnalysisReport, viewer: Viewer | null, includeData: boolean): ReportRecord {
  return {
    id: r.id,
    symbol: r.symbol,
    assetName: r.assetName,
    userId: r.userId,
    isPublic: r.isPublic,
    horizon: r.horizon as Horizon,
    recommendation: r.recommendation,
    riskLevel: r.riskLevel,
    rawScore: r.rawScore,
    score: r.score,
    confidence: r.confidence,
    dataQuality: r.dataQuality,
    priceAtAnalysis: r.priceAtAnalysis,
    change24h: r.change24h,
    isMock: r.isMock,
    createdAt: r.createdAt.toISOString(),
    persisted: true,
    isOwner: viewer !== null && r.userId === viewer.id,
    data: includeData ? (r.data as unknown as AnalysisReportData) : undefined,
  };
}

/** شرط الوصول: العامة + تقارير المستخدم نفسه. البيانات التجريبية لا تظهر في الإنتاج. */
function accessWhere(viewer: Viewer | null): Prisma.AnalysisReportWhereInput {
  const visibility: Prisma.AnalysisReportWhereInput =
    viewer?.role === "ADMIN" ? {} : viewer ? { OR: [{ isPublic: true }, { userId: viewer.id }] } : { isPublic: true };
  return isProd() ? { AND: [visibility, { isMock: false }] } : visibility;
}

export async function listReports(q: ReportsQuery, viewer: Viewer | null) {
  const filters: Prisma.AnalysisReportWhereInput[] = [accessWhere(viewer)];
  if (q.q) {
    filters.push({
      OR: [
        { symbol: { contains: q.q.toUpperCase().replace("/", "") } },
        { assetName: { contains: q.q, mode: "insensitive" } },
        { asset: { nameAr: { contains: q.q } } },
      ],
    });
  }
  if (q.recommendation) filters.push({ recommendation: { in: RECOMMENDATION_GROUPS[q.recommendation].values } });
  if (q.risk) filters.push({ riskLevel: q.risk });
  if (q.horizon) filters.push({ horizon: q.horizon });
  if (q.mine === "true") {
    if (!viewer) throw new HttpError(401, "يجب تسجيل الدخول لعرض تقاريرك");
    filters.push({ userId: viewer.id });
  }
  const orderBy: Prisma.AnalysisReportOrderByWithRelationInput[] =
    q.sort === "confidence"
      ? [{ confidence: "desc" }, { createdAt: "desc" }]
      : q.sort === "score"
        ? [{ score: "desc" }, { createdAt: "desc" }]
        : q.sort === "change"
          ? [{ change24h: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }];
  const where: Prisma.AnalysisReportWhereInput = { AND: filters };
  const [total, rows] = await Promise.all([
    prisma.analysisReport.count({ where }),
    prisma.analysisReport.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      omit: { data: true },
    }),
  ]);
  return {
    items: rows.map((r) => toRecord({ ...r, data: null } as AnalysisReport, viewer, false)),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export async function getReportById(id: string, viewer: Viewer | null): Promise<ReportRecord> {
  const r = await prisma.analysisReport.findUnique({ where: { id } });
  if (!r || (isProd() && r.isMock)) throw new HttpError(404, "التقرير غير موجود");
  if (!canViewReport(r, viewer)) {
    // نعيد 404 بدل 403 حتى لا نكشف وجود تقارير خاصة
    throw new HttpError(404, "التقرير غير موجود");
  }
  return toRecord(r, viewer, true);
}

export async function getLatestReport(symbol: string, viewer: Viewer | null, horizon?: Horizon): Promise<ReportRecord | null> {
  const r = await prisma.analysisReport.findFirst({
    where: { AND: [accessWhere(viewer), { symbol }, horizon ? { horizon } : {}] },
    orderBy: { createdAt: "desc" },
  });
  return r ? toRecord(r, viewer, true) : null;
}

/** آخر درجة تحليل لكل رمز (للوحة التحكم والمفضلة) */
export async function latestScores(symbols: string[], viewer: Viewer | null): Promise<Record<string, { score: number; recommendation: string; createdAt: string; id: string }>> {
  if (symbols.length === 0) return {};
  try {
    const rows = await prisma.analysisReport.findMany({
      where: { AND: [accessWhere(viewer), { symbol: { in: symbols } }] },
      orderBy: { createdAt: "desc" },
      distinct: ["symbol"],
      select: { id: true, symbol: true, score: true, recommendation: true, createdAt: true },
    });
    return Object.fromEntries(rows.map((r) => [r.symbol, { id: r.id, score: r.score, recommendation: r.recommendation, createdAt: r.createdAt.toISOString() }]));
  } catch (e) {
    logError("reports.latestScores", e);
    return {};
  }
}
