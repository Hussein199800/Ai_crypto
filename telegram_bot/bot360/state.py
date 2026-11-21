"""All user settings and scheduled items, persisted in one JSON file."""

from __future__ import annotations

import copy
import json
import re
import secrets
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

FILE = Path(__file__).resolve().parent.parent / "state.json"

DEFAULTS: dict = {
    "providers": {"Claude": True, "Gemini": True, "ChatGPT": True},
    "tools_off": [],  # BOT 360 buttons the user switched off
    "sources": {"bot360": True, "webapp": True, "technicals": True, "fundamentals": True, "market": True, "channels": True},
    "notify": {
        "decision_change": True, "channel_posts": True, "news": True,
        "market_shock": True, "daily_summary": True,
    },
    "tz": "Asia/Damascus",
    "summary_time": "09:00",
    "watch_every_hours": 4,
    "shock_pct": 3.0,
    "watchlist": [],
    "alerts": [],      # {id, symbol, op, price}
    "trades": [],      # {id, symbol, entry, stop, tps, state, hit}
    "reminders": [],   # {id, at, text}
    "schedules": [],   # {id, symbols, kind: every|daily, hours|time, next|last_date}
    "last_decision": {},  # symbol -> {scalp, swing}
    "plans": {},       # id -> plan from a recent analysis (for the "follow trade" button)
    "news_seen": [],
    "last_summary_date": None,
    "last_watch_run": 0,
}

_data: dict | None = None


def get() -> dict:
    global _data
    if _data is None:
        try:
            loaded = json.loads(FILE.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError):
            loaded = {}
        _data = copy.deepcopy(DEFAULTS)
        for k, v in loaded.items():
            if isinstance(v, dict) and isinstance(_data.get(k), dict):
                _data[k].update(v)
            else:
                _data[k] = v
    return _data


def save() -> None:
    FILE.write_text(json.dumps(get(), ensure_ascii=False, indent=1), encoding="utf-8")


def new_id() -> str:
    return secrets.token_hex(3)


def tz() -> ZoneInfo:
    try:
        return ZoneInfo(get()["tz"])
    except Exception:
        return ZoneInfo("UTC")


def now_local() -> datetime:
    return datetime.now(tz())


def fmt_ts(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz()).strftime("%Y-%m-%d %H:%M")


_DUR = re.compile(r"^(\d+(?:\.\d+)?)\s*(m|h|d|د|س|ي)$", re.I)
_UNIT = {"m": 60, "د": 60, "h": 3600, "س": 3600, "d": 86400, "ي": 86400}


def parse_duration(text: str) -> float | None:
    """'30m', '3h', '2d' (or Arabic د/س/ي) -> seconds."""
    m = _DUR.match(text.strip())
    return float(m.group(1)) * _UNIT[m.group(2).lower()] if m else None


def parse_when(text: str) -> float | None:
    """'3h' | 'HH:MM' (next occurrence) | 'YYYY-MM-DD HH:MM' -> epoch seconds."""
    text = text.strip()
    if (d := parse_duration(text)) is not None:
        return time.time() + d
    now = now_local()
    for fmt in ("%Y-%m-%d %H:%M", "%H:%M"):
        try:
            t = datetime.strptime(text, fmt)
        except ValueError:
            continue
        if fmt == "%H:%M":
            t = now.replace(hour=t.hour, minute=t.minute, second=0, microsecond=0)
            if t <= now:
                t += timedelta(days=1)
        else:
            t = t.replace(tzinfo=tz())
        return t.timestamp()
    return None


def valid_hhmm(text: str) -> bool:
    return re.fullmatch(r"([01]?\d|2[0-3]):[0-5]\d", text.strip()) is not None
