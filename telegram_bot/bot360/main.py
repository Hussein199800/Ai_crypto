"""Entry point: control bot (BotFather token) + userbot (your account).

Send the control bot a coin name like `ETH`. It collects BOT 360 tools,
independent technicals, fundamentals, market regime, news and your analyst
channels, then the expert writes one explicit spot decision.

Commands:
  ETH                          analyse a coin
  /addch @channel وصف أسلوبه   follow an analyst channel
  /delch @channel              stop following it
  /channels                    list followed channels
"""

from __future__ import annotations

import asyncio
import logging
import re

from telethon import TelegramClient, events

from . import channels, config
from .collector import Collector
from .decision import decide, render
from .expert import ask_expert, build_input
from .market import gather_all
from .parser import parse_reply
from .price import spot_price

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
SYMBOL = re.compile(r"^/?(?:a\s+)?([A-Za-z0-9]{2,15})$")
TG_LIMIT = 4000


async def analyse(user: TelegramClient, col: Collector, s: config.Settings, symbol: str) -> str:
    tools = list(dict.fromkeys(s.scalp_tools + s.swing_tools))
    # BOT 360 is sequential (one chat); everything else runs alongside it.
    raw, market, posts, price = await asyncio.gather(
        col.run_many(tools, symbol),
        gather_all(symbol),
        channels.recent_posts(user, symbol),
        spot_price(symbol),
    )
    readings = {t: parse_reply(t, txt) for t, txt in raw.items()}
    if price is None:
        price = next((r.price for r in readings.values() if r.price), None)

    failed = [t for t, r in readings.items() if not r.useful]
    rules = render(symbol, price, [
        decide("سكالب (ساعات)", [readings[t] for t in s.scalp_tools if t in readings], price),
        decide("سوينغ (أيام-أسابيع)", [readings[t] for t in s.swing_tools if t in readings], price),
    ], failed)

    verdict = await ask_expert(build_input(symbol, price, raw, market, posts, rules))
    if verdict:
        return f"📊 {symbol} | السعر {price}\n\n{verdict}"
    return rules + "\n\n(الخبير غير متاح الآن — هذا قرار محرك القواعد فقط)"


def chunks(text: str, size: int = TG_LIMIT) -> list[str]:
    out, buf = [], ""
    for line in text.split("\n"):
        if len(buf) + len(line) + 1 > size:
            out.append(buf)
            buf = ""
        buf += line + "\n"
    return out + [buf] if buf.strip() else out


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
            await event.reply(__doc__.split("Commands:")[1])
            return
        if text.startswith("/addch"):
            parts = text.split(maxsplit=2)
            if len(parts) < 2:
                await event.reply("الصيغة: /addch @channel وصف أسلوب المحلل ودقته")
                return
            channels.add(parts[1], parts[2] if len(parts) > 2 else "")
            await event.reply(f"✅ أُضيفت {parts[1]}")
            return
        if text.startswith("/delch"):
            parts = text.split()
            ok = len(parts) > 1 and channels.remove(parts[1])
            await event.reply("🗑️ حُذفت" if ok else "غير موجودة")
            return
        if text == "/channels":
            data = channels.load()
            await event.reply("\n".join(f"• @{k}: {v}" for k, v in data.items()) or "لا توجد قنوات بعد")
            return

        m = SYMBOL.match(text)
        if not m:
            await event.reply("أرسل رمز العملة فقط، مثل: ETH أو SOL")
            return
        symbol = m.group(1).upper()
        status = await event.reply(f"⏳ أحلل {symbol} من كل الزوايا… (قد يأخذ دقيقة أو دقيقتين)")
        try:
            result = await analyse(user, col, s, symbol)
        except Exception as exc:  # report instead of dying silently
            logging.exception("analysis failed")
            result = f"❌ فشل التحليل: {exc}"
        parts = chunks(result)
        await status.edit(parts[0])
        for extra in parts[1:]:
            await event.respond(extra)

    logging.info("ready")
    await asyncio.gather(user.run_until_disconnected(), control.run_until_disconnected())


if __name__ == "__main__":
    asyncio.run(main())
