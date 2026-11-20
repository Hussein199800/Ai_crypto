"""Current spot price from Binance's public API (no key needed)."""

from __future__ import annotations

import httpx


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
