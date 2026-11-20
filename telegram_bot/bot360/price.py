"""Current spot price from Binance's public API (no key needed)."""

from __future__ import annotations

import json

import httpx

API = "https://data-api.binance.vision/api/v3"


async def spot_price(symbol: str, quote: str = "USDT") -> float | None:
    pair = symbol.upper().replace("/", "")
    if not pair.endswith(quote):
        pair += quote
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            r = await http.get("https://data-api.binance.vision/api/v3/ticker/price", params={"symbol": pair})
            if r.status_code == 200:
                return float(r.json()["price"])
    except (httpx.HTTPError, KeyError, ValueError):
        pass
    return None


async def spot_prices(symbols: list[str], quote: str = "USDT") -> dict[str, float]:
    """Prices for many coins in one request -> {"ETH": 1621.6, ...}."""
    if not symbols:
        return {}
    pairs = sorted({s.upper() + quote for s in symbols})
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(f"{API}/ticker/price", params={"symbols": json.dumps(pairs, separators=(",", ":"))})
            if r.status_code != 200:  # one unknown symbol fails the batch: fall back per coin
                return {s.upper(): p for s in symbols if (p := await spot_price(s, quote)) is not None}
            return {d["symbol"][: -len(quote)]: float(d["price"]) for d in r.json()}
    except (httpx.HTTPError, KeyError, ValueError):
        return {}


async def tickers_24h(symbols: list[str], quote: str = "USDT") -> dict[str, dict]:
    """{"ETH": {"price": .., "change_pct": ..}} for the daily summary."""
    if not symbols:
        return {}
    pairs = sorted({s.upper() + quote for s in symbols})
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(f"{API}/ticker/24hr", params={"symbols": json.dumps(pairs, separators=(",", ":"))})
            if r.status_code != 200:
                return {}
            return {
                d["symbol"][: -len(quote)]: {"price": float(d["lastPrice"]), "change_pct": float(d["priceChangePercent"])}
                for d in r.json()
            }
    except (httpx.HTTPError, KeyError, ValueError):
        return {}
