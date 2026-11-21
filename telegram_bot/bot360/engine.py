"""One full analysis of a coin, honouring the user's settings."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from telethon import TelegramClient

from . import channels, config, journal, state
from .collector import Collector
from .decision import Decision, decide, render
from .expert import ask_expert, build_input
from .market import gather_all
from .parser import parse_reply
from .price import spot_price
from .webapp import run_tools as run_webapp_tools

ACTION = {"شراء": "BUY", "انتظار": "WAIT", "لا تشتري / خفّف": "AVOID"}


@dataclass
class Result:
    symbol: str
    price: float | None
    text: str
    summary: dict = field(default_factory=dict)  # scalp, swing, conf, entry, stop, tps, providers


def active_tools(s: config.Settings) -> tuple[list[str], list[str]]:
    off = set(state.get()["tools_off"])
    return [t for t in s.scalp_tools if t not in off], [t for t in s.swing_tools if t not in off]


def _rules_summary(scalp: Decision, swing: Decision) -> dict:
    plan = swing if swing.entry and swing.stop else scalp
    return {
        "scalp": ACTION[scalp.action], "swing": ACTION[swing.action],
        "conf": round((scalp.confidence + swing.confidence) / 2),
        "entry": plan.entry, "stop": plan.stop, "tps": plan.targets or None, "providers": ["القواعد"],
    }


async def _empty(value):
    return value


async def analyse(user: TelegramClient, col: Collector, s: config.Settings, symbol: str) -> Result:
    st = state.get()
    src = st["sources"]
    scalp_tools, swing_tools = active_tools(s)
    tools = list(dict.fromkeys(scalp_tools + swing_tools)) if src["bot360"] else []
    off = set(st["tools_off"])
    app_tools = [t for t in s.webapp_tools if t not in off] if src.get("webapp") else []

    raw, app_raw, market, posts, price = await asyncio.gather(
        col.run_many(tools, symbol) if tools else _empty({}),
        run_webapp_tools(user, s.source_bot, app_tools, symbol) if app_tools else _empty({}),
        gather_all(symbol, technicals=src["technicals"], fundamentals=src["fundamentals"], market=src["market"]),
        channels.recent_posts(user, symbol) if src["channels"] else _empty([]),
        spot_price(symbol),
    )
    readings = {t: parse_reply(t, txt) for t, txt in raw.items()}
    if price is None:
        price = next((r.price for r in readings.values() if r.price), None)

    failed = [t for t, r in readings.items() if not r.useful]
    d_scalp = decide("سكالب (ساعات)", [readings[t] for t in scalp_tools if t in readings], price)
    d_swing = decide("سوينغ (أيام-أسابيع)", [readings[t] for t in swing_tools if t in readings], price)
    rules_text = render(symbol, price, [d_scalp, d_swing], failed)

    enabled = {n for n, on in st["providers"].items() if on}
    # The Mini App tools go to the experts as raw text alongside the chat tools.
    all_raw = {**raw, **app_raw}
    text, summary = await ask_expert(build_input(symbol, price, all_raw, market, posts, rules_text), enabled)
    if text:
        text = f"📊 {symbol} | السعر {price}\n\n{text}"
    else:
        text = rules_text + "\n\n(لا يوجد خبير مفعّل بمفتاح صالح — هذا قرار محرك القواعد)"
    if not summary.get("swing"):
        summary = _rules_summary(d_scalp, d_swing) | {"providers": summary.get("providers", ["القواعد"])}

    journal.record({"symbol": symbol, "price": price, **summary})
    return Result(symbol, price, text, summary)
