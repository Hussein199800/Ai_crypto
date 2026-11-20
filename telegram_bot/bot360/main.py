"""Entry point: control bot (BotFather token) + userbot (your account).

Send the control bot a coin name like `ETH` and it replies with a spot
decision for scalp and swing horizons.
"""

from __future__ import annotations

import asyncio
import logging
import re

from telethon import TelegramClient, events

from . import config
from .collector import Collector
from .decision import decide, render
from .parser import parse_reply
from .price import spot_price

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
SYMBOL = re.compile(r"^/?(?:a\s+)?([A-Za-z0-9]{2,15})$")


async def analyse(col: Collector, s: config.Settings, symbol: str) -> str:
    tools = list(dict.fromkeys(s.scalp_tools + s.swing_tools))
    raw = await col.run_many(tools, symbol)
    readings = {t: parse_reply(t, txt) for t, txt in raw.items()}

    price = await spot_price(symbol)
    if price is None:  # fall back to a price printed by the source bot
        price = next((r.price for r in readings.values() if r.price), None)

    failed = [t for t, r in readings.items() if not r.useful]
    decisions = [
        decide("سكالب (ساعات)", [readings[t] for t in s.scalp_tools if t in readings], price),
        decide("سوينغ (أيام-أسابيع)", [readings[t] for t in s.swing_tools if t in readings], price),
    ]
    return render(symbol, price, decisions, failed)


async def main() -> None:
    s = config.load()
    user = TelegramClient("user_session", s.api_id, s.api_hash)
    control = TelegramClient("control_session", s.api_id, s.api_hash)
    await user.start()  # first run asks for phone + login code in the terminal
    await control.start(bot_token=s.control_bot_token)

    col = Collector(user, s.source_bot, s.reply_quiet_seconds, s.reply_max_seconds, s.pause_between_tools)
    await col.start()

    @control.on(events.NewMessage(incoming=True))
    async def on_cmd(event):  # noqa: ANN001
        if event.sender_id != s.owner_id:
            return
        text = (event.raw_text or "").strip()
        if text in ("/start", "/help"):
            await event.reply("أرسل اسم العملة مثل: ETH")
            return
        m = SYMBOL.match(text)
        if not m:
            await event.reply("أرسل رمز العملة فقط، مثل: ETH أو SOL")
            return
        symbol = m.group(1).upper()
        status = await event.reply(f"⏳ جارٍ تحليل {symbol} عبر أدوات BOT 360…")
        try:
            result = await analyse(col, s, symbol)
        except Exception as exc:  # report instead of dying silently
            logging.exception("analysis failed")
            result = f"❌ فشل التحليل: {exc}"
        await status.edit(result)

    logging.info("ready")
    await asyncio.gather(user.run_until_disconnected(), control.run_until_disconnected())


if __name__ == "__main__":
    asyncio.run(main())
