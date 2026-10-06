-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('CRYPTO', 'STABLECOIN', 'DOMINANCE', 'INDEX', 'PAIR');

-- CreateEnum
CREATE TYPE "Horizon" AS ENUM ('SHORT', 'MEDIUM', 'LONG');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('POSSIBLE_BUY', 'GRADUAL_BUY', 'NEUTRAL', 'REDUCE_RISK', 'NO_BUY', 'POSSIBLE_SELL', 'MARKET_INDICATOR');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_MOVE', 'SUPPORT_BREAK', 'RESISTANCE_BREAK', 'BTC_D_CHANGE', 'USDT_D_RISE', 'EMA_CROSS', 'TREND_CHANGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "kind" "AssetKind" NOT NULL DEFAULT 'CRYPTO',
    "coingeckoId" TEXT,
    "binanceSymbol" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "totalMarketCap" DOUBLE PRECISION NOT NULL,
    "totalVolume24h" DOUBLE PRECISION,
    "btcMarketCap" DOUBLE PRECISION,
    "ethMarketCap" DOUBLE PRECISION,
    "usdtMarketCap" DOUBLE PRECISION,
    "btcDominance" DOUBLE PRECISION,
    "ethDominance" DOUBLE PRECISION,
    "usdtDominance" DOUBLE PRECISION,
    "marketCapChange24h" DOUBLE PRECISION,
    "fearGreed" INTEGER,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OHLCV" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OHLCV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorSnapshot" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisReport" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "horizon" "Horizon" NOT NULL,
    "recommendation" "Recommendation" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "rawScore" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "dataQuality" INTEGER NOT NULL,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "priceAtAnalysis" DOUBLE PRECISION,
    "change24h" DOUBLE PRECISION,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "sources" TEXT[],
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "threshold" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 240,
    "lastTriggeredAt" TIMESTAMP(3),
    "lastState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataProviderLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataProviderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "Asset_kind_idx" ON "Asset"("kind");

-- CreateIndex
CREATE INDEX "MarketSnapshot_createdAt_idx" ON "MarketSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "MarketSnapshot_isMock_createdAt_idx" ON "MarketSnapshot"("isMock", "createdAt");

-- CreateIndex
CREATE INDEX "OHLCV_symbol_timeframe_time_idx" ON "OHLCV"("symbol", "timeframe", "time");

-- CreateIndex
CREATE UNIQUE INDEX "OHLCV_symbol_timeframe_time_key" ON "OHLCV"("symbol", "timeframe", "time");

-- CreateIndex
CREATE INDEX "IndicatorSnapshot_symbol_timeframe_createdAt_idx" ON "IndicatorSnapshot"("symbol", "timeframe", "createdAt");

-- CreateIndex
CREATE INDEX "IndicatorSnapshot_reportId_idx" ON "IndicatorSnapshot"("reportId");

-- CreateIndex
CREATE INDEX "AnalysisReport_symbol_createdAt_idx" ON "AnalysisReport"("symbol", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisReport_userId_createdAt_idx" ON "AnalysisReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisReport_createdAt_idx" ON "AnalysisReport"("createdAt");

-- CreateIndex
CREATE INDEX "AnalysisReport_recommendation_idx" ON "AnalysisReport"("recommendation");

-- CreateIndex
CREATE INDEX "AnalysisReport_score_idx" ON "AnalysisReport"("score");

-- CreateIndex
CREATE INDEX "AnalysisReport_confidence_idx" ON "AnalysisReport"("confidence");

-- CreateIndex
CREATE INDEX "AnalysisReport_isPublic_isMock_createdAt_idx" ON "AnalysisReport"("isPublic", "isMock", "createdAt");

-- CreateIndex
CREATE INDEX "Watchlist_userId_position_idx" ON "Watchlist"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_symbol_key" ON "Watchlist"("userId", "symbol");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_symbol_idx" ON "Alert"("symbol");

-- CreateIndex
CREATE INDEX "Alert_isActive_idx" ON "Alert"("isActive");

-- CreateIndex
CREATE INDEX "AlertEvent_userId_createdAt_idx" ON "AlertEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DataProviderLog_provider_createdAt_idx" ON "DataProviderLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "DataProviderLog_createdAt_idx" ON "DataProviderLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorSnapshot" ADD CONSTRAINT "IndicatorSnapshot_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AnalysisReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Asset"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
