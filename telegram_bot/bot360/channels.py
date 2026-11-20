"""Analyst Telegram channels the user follows.

Each channel is stored with a free-text "method" note written by the user
(e.g. "Wyckoff، دقيق في السوينغ، يبالغ في الأهداف") so the expert knows how
to weigh that analyst. Recent posts that mention the coin are pulled with
the user's own account.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from telethon import TelegramClient

STORE = Path(__file__).resolve().parent.parent / "channels.json"


def load() -> dict[str, str]:
    try:
        return json.loads(STORE.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return {}


def save(data: dict[str, str]) -> None:
    STORE.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def add(handle: str, method: str) -> None:
    data = load()
    data[handle.lstrip("@").lower()] = method.strip() or "بدون وصف"
    save(data)


def remove(handle: str) -> bool:
    data = load()
    gone = data.pop(handle.lstrip("@").lower(), None) is not None
    save(data)
    return gone


def mentions(symbol: str, text: str) -> bool:
    s = re.escape(symbol.upper())
    return re.search(rf"(?<![A-Z0-9])[#$]?{s}(?:/?USDT)?(?![A-Z0-9])", text.upper()) is not None


async def recent_posts(client: TelegramClient, symbol: str, days: int = 7, per_channel: int = 4) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    out: list[dict] = []
    for handle, method in load().items():
        found = 0
        try:
            async for msg in client.iter_messages(handle, limit=300):
                if msg.date < since:
                    break
                text = msg.raw_text or ""
                if text and mentions(symbol, text):
                    out.append({
                        "channel": handle, "method": method,
                        "date": msg.date.strftime("%Y-%m-%d %H:%M UTC"),
                        "text": text[:1500],
                    })
                    found += 1
                    if found >= per_channel:
                        break
        except Exception as exc:  # private / renamed channel: report, keep going
            out.append({"channel": handle, "method": method, "error": str(exc)[:200]})
    return out
