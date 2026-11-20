"""Crypto news watcher (free RSS feeds).

Headlines are sorted into: 🚨 security (hacks, exploits), 🌍 macro/political
(war, tariffs, Fed, SEC, bans) and 🟢 opportunity (listings, ETF approvals,
upgrades). Anything mentioning a watchlist coin is always sent.
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET

import httpx

log = logging.getLogger(__name__)

FEEDS = [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed",
]

CATEGORIES = [
    ("🚨 خطر أمني", r"hack|exploit|breach|drain|stolen|attack(?:er)?|vulnerab|compromis|rug ?pull|اختراق|سرقة"),
    ("🌍 سياسي/اقتصادي", r"\bwar\b|tariff|sanction|\bfed\b|rate (?:hike|cut)|inflation|\bcpi\b|\bsec\b|lawsuit|"
                        r"\bban(?:s|ned)?\b|crackdown|regulat|recession|missile|liquidat|حرب|عقوبات|الفيدرالي"),
    ("🟢 فرصة", r"\blist(?:s|ing|ed)\b|etf (?:approv|launch)|approv|partnership|mainnet|upgrade|airdrop|integrat|"
               r"adopt|إدراج|شراكة"),
]


def classify(title: str) -> str | None:
    for name, pattern in CATEGORIES:
        if re.search(pattern, title, re.I):
            return name
    return None


ALIASES = {
    "BTC": ["BITCOIN"], "ETH": ["ETHEREUM", "ETHER"], "SOL": ["SOLANA"], "BNB": ["BINANCE COIN"],
    "ADA": ["CARDANO"], "DOGE": ["DOGECOIN"], "AVAX": ["AVALANCHE"], "ARB": ["ARBITRUM"], "OP": ["OPTIMISM"],
    "LINK": ["CHAINLINK"], "DOT": ["POLKADOT"], "TRX": ["TRON"], "APT": ["APTOS"], "POL": ["POLYGON"],
    "MATIC": ["POLYGON"], "LTC": ["LITECOIN"], "XRP": ["RIPPLE"], "TON": ["TONCOIN"], "SUI": [], "NEAR": [],
}


def mentioned(title: str, watchlist: list[str]) -> list[str]:
    up = title.upper()
    found = []
    for s in watchlist:
        names = [s] + ALIASES.get(s, [])
        if any(re.search(rf"(?<![A-Z0-9]){re.escape(n)}(?![A-Z0-9])", up) for n in names):
            found.append(s)
    return found


def parse_rss(xml_text: str) -> list[dict]:
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        if title and link:
            items.append({"title": title, "link": link})
    return items


async def fetch_all() -> list[dict]:
    out: list[dict] = []
    async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                 headers={"User-Agent": "Mozilla/5.0 (news-reader)"}) as http:
        for url in FEEDS:
            try:
                r = await http.get(url)
                if r.status_code == 200:
                    out += parse_rss(r.text)
            except httpx.HTTPError as exc:
                log.warning("feed %s: %s", url, exc)
    return out


def pick(items: list[dict], seen: set[str], watchlist: list[str]) -> list[dict]:
    """New headlines worth a notification, tagged with category / coins."""
    picked = []
    for it in items:
        if it["link"] in seen:
            continue
        cat = classify(it["title"])
        coins = mentioned(it["title"], watchlist)
        if cat or coins:
            picked.append(dict(it, category=cat or "📰 خبر", coins=coins))
    return picked
