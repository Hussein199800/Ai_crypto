"""Free public data: independent technicals (Binance), fundamentals
(CoinGecko) and the overall market regime (CoinGecko global + Fear & Greed).
Every function returns None / partial data instead of raising, so one dead
source never blocks a decision.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

log = logging.getLogger(__name__)
BINANCE = "https://data-api.binance.vision/api/v3"
GECKO = "https://api.coingecko.com/api/v3"


# ---------- indicators ----------

def ema(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    k = 2 / (period + 1)
    e = sum(values[:period]) / period
    for v in values[period:]:
        e = v * k + e * (1 - k)
    return e


def rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) <= period:
        return None
    gains = losses = 0.0
    for a, b in zip(closes[:period], closes[1 : period + 1]):
        d = b - a
        gains += max(d, 0)
        losses += max(-d, 0)
    ag, al = gains / period, losses / period
    for a, b in zip(closes[period:], closes[period + 1 :]):
        d = b - a
        ag = (ag * (period - 1) + max(d, 0)) / period
        al = (al * (period - 1) + max(-d, 0)) / period
    if al == 0:
        return 100.0
    return 100 - 100 / (1 + ag / al)


def summarize_tf(candles: list[list]) -> dict:
    closes = [float(c[4]) for c in candles]
    highs = [float(c[2]) for c in candles]
    lows = [float(c[3]) for c in candles]
    vols = [float(c[5]) for c in candles]
    last = closes[-1]
    e20, e50, e200 = ema(closes, 20), ema(closes, 50), ema(closes, 200)
    trend = "غير محدد"
    if e20 and e50:
        if last > e20 > e50:
            trend = "صاعد"
        elif last < e20 < e50:
            trend = "هابط"
        else:
            trend = "عرضي/متذبذب"
    r = rsi(closes)
    recent = slice(-50, None)
    avg_vol = sum(vols[-21:-1]) / 20 if len(vols) > 21 else None
    return {
        "close": last,
        "rsi14": round(r, 1) if r is not None else None,
        "ema20": e20, "ema50": e50, "ema200": e200,
        "trend": trend,
        "change_pct_20": round((last / closes[-21] - 1) * 100, 2) if len(closes) > 21 else None,
        "high_50": max(highs[recent]), "low_50": min(lows[recent]),
        "volume_vs_avg20": round(vols[-1] / avg_vol, 2) if avg_vol else None,
    }


# ---------- sources ----------

async def _get(http: httpx.AsyncClient, url: str, **params):
    try:
        r = await http.get(url, params=params or None)
        if r.status_code == 200:
            return r.json()
        log.warning("%s -> %s", url, r.status_code)
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("%s failed: %s", url, exc)
    return None


async def _technicals(http: httpx.AsyncClient, symbol: str) -> dict | None:
    pair = symbol.upper() + "USDT"
    out = {}
    for tf in ("1h", "4h", "1d"):
        k = await _get(http, f"{BINANCE}/klines", symbol=pair, interval=tf, limit=250)
        if k:
            out[tf] = summarize_tf(k)
    return out or None


async def _fundamentals(http: httpx.AsyncClient, symbol: str) -> dict | None:
    found = await _get(http, f"{GECKO}/search", query=symbol)
    if not found:
        return None
    coins = [c for c in found.get("coins", []) if c.get("symbol", "").upper() == symbol.upper()]
    if not coins:
        return None
    coins.sort(key=lambda c: c.get("market_cap_rank") or 10**9)
    data = await _get(
        http, f"{GECKO}/coins/{coins[0]['id']}",
        localization="false", tickers="false", community_data="false", developer_data="false",
    )
    if not data:
        return None
    md = data.get("market_data", {})
    usd = lambda k: (md.get(k) or {}).get("usd")  # noqa: E731
    mcap, fdv = usd("market_cap"), usd("fully_diluted_valuation")
    return {
        "name": data.get("name"),
        "rank": data.get("market_cap_rank"),
        "categories": (data.get("categories") or [])[:5],
        "market_cap": mcap,
        "fdv": fdv,
        "mcap_to_fdv": round(mcap / fdv, 2) if mcap and fdv else None,
        "volume_24h": usd("total_volume"),
        "volume_to_mcap": round(usd("total_volume") / mcap, 3) if mcap and usd("total_volume") else None,
        "circulating": md.get("circulating_supply"),
        "total_supply": md.get("total_supply"),
        "max_supply": md.get("max_supply"),
        "ath": usd("ath"),
        "from_ath_pct": (md.get("ath_change_percentage") or {}).get("usd"),
        "change_7d_pct": md.get("price_change_percentage_7d"),
        "change_30d_pct": md.get("price_change_percentage_30d"),
        "change_1y_pct": md.get("price_change_percentage_1y"),
    }


async def market_regime(http: httpx.AsyncClient) -> dict | None:
    glob, fng, btc = await asyncio.gather(
        _get(http, f"{GECKO}/global"),
        _get(http, "https://api.alternative.me/fng/", limit=7),
        _technicals(http, "BTC"),
    )
    out: dict = {}
    if glob and "data" in glob:
        g = glob["data"]
        out["btc_dominance"] = round(g["market_cap_percentage"].get("btc", 0), 2)
        out["total_mcap_change_24h_pct"] = round(g.get("market_cap_change_percentage_24h_usd") or 0, 2)
    if fng and fng.get("data"):
        out["fear_greed_now"] = f'{fng["data"][0]["value"]} ({fng["data"][0]["value_classification"]})'
        out["fear_greed_7d"] = [int(d["value"]) for d in fng["data"]]
    if btc:
        out["btc"] = {tf: {k: v[k] for k in ("close", "trend", "rsi14", "change_pct_20")} for tf, v in btc.items()}
    return out or None


async def _none():
    return None


async def gather_all(symbol: str, technicals: bool = True, fundamentals: bool = True, market: bool = True) -> dict:
    """Each source can be switched off from the settings menu."""
    async with httpx.AsyncClient(timeout=12) as http:
        tech, fund, regime = await asyncio.gather(
            _technicals(http, symbol) if technicals else _none(),
            _fundamentals(http, symbol) if fundamentals else _none(),
            market_regime(http) if market else _none(),
        )
    out = {"technicals": tech, "fundamentals": fund, "market": regime}
    return {k: (v if v is not None else "معطّل أو غير متاح") for k, v in out.items()}
