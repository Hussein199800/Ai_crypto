"""Entry point: control bot (BotFather token) + userbot (your account).

The control bot has a menu keyboard, a settings panel with on/off buttons,
price alerts, trade follow-up, reminders, scheduled analyses, a daily
summary, news / channel notifications and a decision log. Send /help.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time

from telethon import TelegramClient, events

from . import channels, config, journal, news, state, ui
from .collector import Collector
from .engine import Result, analyse
from .price import spot_price, spot_prices
from .scheduler import Scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
SYMBOL = re.compile(r"^/?(?:a\s+)?([A-Za-z0-9]{2,15})$")
NUM = r"(\d+(?:\.\d+)?)"
TG_LIMIT = 4000


def chunks(text: str, size: int = TG_LIMIT) -> list[str]:
    out, buf = [], ""
    for line in text.split("\n"):
        if len(buf) + len(line) + 1 > size:
            out.append(buf)
            buf = ""
        buf += line + "\n"
    return out + [buf] if buf.strip() else out


def symbols_of(text: str) -> list[str]:
    return [w.upper() for w in text.split() if re.fullmatch(r"[A-Za-z0-9]{2,15}", w)]


def store_plan(res: Result) -> str | None:
    s = res.summary
    if not (s.get("entry") and s.get("stop")) or s.get("swing") == "AVOID" and s.get("scalp") == "AVOID":
        return None
    st = state.get()
    pid = state.new_id()
    st["plans"][pid] = {"symbol": res.symbol, "entry": s["entry"], "stop": s["stop"], "tps": s.get("tps") or []}
    st["plans"] = dict(list(st["plans"].items())[-30:])
    state.save()
    return pid


def new_trade(symbol: str, entry: float, stop: float, tps: list[float], price: float | None) -> dict:
    opened = price is not None and price <= entry * 1.003
    return {"id": state.new_id(), "symbol": symbol, "entry": entry, "stop": stop,
            "tps": sorted(tps), "state": "open" if opened else "waiting", "hit": []}


async def main() -> None:
    s = config.load()
    user = TelegramClient("user_session", s.api_id, s.api_hash)
    control = TelegramClient("control_session", s.api_id, s.api_hash)
    await user.start()  # first run asks for phone + login code in the terminal
    await control.start(bot_token=s.control_bot_token)

    col = Collector(user, s.source_bot, s.reply_quiet_seconds, s.reply_max_seconds, s.pause_between_tools)
    await col.start()
    owner = s.owner_id

    async def notify(text: str, buttons=None) -> None:
        parts = chunks(text)
        for i, part in enumerate(parts):
            await control.send_message(owner, part, buttons=buttons if i == len(parts) - 1 else None)

    async def run_analysis(symbol: str) -> Result:
        res = await analyse(user, col, s, symbol)
        st = state.get()
        if res.summary.get("swing"):
            st["last_decision"][symbol] = {"scalp": res.summary.get("scalp"), "swing": res.summary.get("swing")}
            state.save()
        return res

    async def send_result(res: Result, header: str | None = None, status=None) -> None:
        text = f"{header}\n\n{res.text}" if header else res.text
        buttons = ui.analysis_buttons(res.symbol, store_plan(res))
        parts = chunks(text)
        if status is not None:
            await status.edit(parts[0], buttons=buttons if len(parts) == 1 else None)
            parts = parts[1:]
        for i, part in enumerate(parts):
            await control.send_message(owner, part, buttons=buttons if i == len(parts) - 1 else None)

    async def analyse_and_reply(symbol: str, event) -> None:
        status = await event.respond(f"⏳ أحلل {symbol} من كل الزوايا… (دقيقة إلى دقيقتين)")
        try:
            await send_result(await run_analysis(symbol), status=status)
        except Exception as exc:
            logging.exception("analysis failed")
            await status.edit(f"❌ فشل التحليل: {exc}")

    # ---------- text commands ----------
    @control.on(events.NewMessage(incoming=True, func=lambda e: e.sender_id == owner))
    async def on_msg(event):  # noqa: ANN001, C901
        text = (event.raw_text or "").strip()
        st = state.get()
        cmd, _, rest = text.partition(" ")
        rest = rest.strip()

        async def show(view):
            body, buttons = view
            await event.respond(body, buttons=buttons)

        if text in ("/start", "❓ المساعدة", "/help"):
            await event.respond(ui.HELP, buttons=ui.MAIN_MENU)
        elif text in ("⚙️ الإعدادات", "/settings"):
            await show(ui.settings_main())
        elif text == "📊 تحليل":
            await event.respond("أرسل رمز العملة، مثل: ETH")
        elif text in ("⭐ المراقبة", "/watchlist"):
            await show(ui.view_watchlist())
        elif text in ("🔔 التنبيهات", "/alerts"):
            await show(ui.view_alerts())
        elif text in ("💼 صفقاتي", "/trades"):
            await show(ui.view_trades())
        elif text in ("⏰ التذكيرات والجدولة", "/reminders"):
            await show(ui.view_reminders())
        elif text in ("📢 القنوات", "/channels"):
            await show(ui.view_channels())
        elif text in ("📜 السجل", "/log"):
            syms = list({r["symbol"] for r in journal.recent()})
            await event.respond(journal.review(await spot_prices(syms)))

        elif cmd == "/watch":
            syms = symbols_of(rest)
            for sym in syms:
                if sym not in st["watchlist"]:
                    st["watchlist"].append(sym)
            state.save()
            await event.respond(f"⭐ أُضيف: {' '.join(syms)}" if syms else "الصيغة: /watch ETH SOL")
        elif cmd == "/unwatch":
            st["watchlist"] = [x for x in st["watchlist"] if x not in symbols_of(rest)]
            state.save()
            await event.respond("🗑️ تم")

        elif cmd == "/alert":
            m = re.fullmatch(rf"([A-Za-z0-9]{{2,15}})\s*([<>])\s*{NUM}", rest)
            if not m:
                await event.respond("الصيغة: /alert ETH < 1600  أو  /alert ETH > 1800")
                return
            st["alerts"].append({"id": state.new_id(), "symbol": m.group(1).upper(), "op": m.group(2),
                                 "price": float(m.group(3))})
            state.save()
            await event.respond(f"🔔 سأنبهك عندما يكون {m.group(1).upper()} {m.group(2)} {m.group(3)}")

        elif cmd == "/trade":
            parts = rest.split()
            try:
                sym, entry, stop, *tps = parts[0].upper(), *map(float, parts[1:])
                assert stop < entry and all(tp > entry for tp in tps)
            except (ValueError, IndexError, AssertionError):
                await event.respond("الصيغة: /trade ETH 1620 1580 1700 1750\n(دخول، وقف أقل من الدخول، ثم أهداف أعلى منه)")
                return
            st["trades"].append(new_trade(sym, entry, stop, tps, await spot_price(sym)))
            state.save()
            await event.respond(f"📌 أتابع صفقة {sym}. سأنبهك عند الدخول والأهداف والوقف.")

        elif cmd == "/remind":
            m = re.match(r"^(\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}|\d{1,2}:\d{2}|\d+(?:\.\d+)?\s*[mhdدسي])\s+(.+)$", rest)
            at = state.parse_when(m.group(1)) if m else None
            if not at:
                await event.respond("الصيغة: /remind 3h النص  |  /remind 21:00 النص  |  /remind 2026-12-01 09:00 النص")
                return
            st["reminders"].append({"id": state.new_id(), "at": at, "text": m.group(2)})
            state.save()
            await event.respond(f"⏰ سأذكّرك في {state.fmt_ts(at)}")

        elif cmd == "/every":
            first, _, syms_txt = rest.partition(" ")
            secs, syms = state.parse_duration(first), symbols_of(syms_txt)
            if not secs or secs < 3600 or not syms:
                await event.respond("الصيغة: /every 4h ETH SOL  (ساعة على الأقل)")
                return
            st["schedules"].append({"id": state.new_id(), "symbols": syms, "kind": "every",
                                    "hours": round(secs / 3600, 2), "next": time.time() + secs})
            state.save()
            await event.respond(f"🗓️ سأحلل {' '.join(syms)} كل {round(secs / 3600, 2)} ساعة")
        elif cmd == "/daily":
            first, _, syms_txt = rest.partition(" ")
            syms = symbols_of(syms_txt)
            if not state.valid_hhmm(first) or not syms:
                await event.respond("الصيغة: /daily 09:00 BTC ETH")
                return
            st["schedules"].append({"id": state.new_id(), "symbols": syms, "kind": "daily",
                                    "time": first.zfill(5), "last_date": None})
            state.save()
            await event.respond(f"🗓️ سأحلل {' '.join(syms)} يوميًا الساعة {first}")
        elif cmd == "/summary":
            if not state.valid_hhmm(rest):
                await event.respond("الصيغة: /summary 08:30")
                return
            st["summary_time"], st["last_summary_date"] = rest.zfill(5), None
            state.save()
            await event.respond(f"☀️ الملخص اليومي الساعة {rest}")
        elif cmd == "/tz":
            from zoneinfo import ZoneInfo
            try:
                ZoneInfo(rest)
            except Exception:
                await event.respond("منطقة غير معروفة. أمثلة: Asia/Damascus, Asia/Riyadh, Europe/Istanbul")
                return
            st["tz"] = rest
            state.save()
            await event.respond(f"🕐 المنطقة الزمنية: {rest}")

        elif cmd == "/addch":
            handle, _, method = rest.partition(" ")
            if not handle:
                await event.respond("الصيغة: /addch @channel وصف أسلوب المحلل ودقته")
                return
            channels.add(handle, method)
            await event.respond(f"✅ أُضيفت {handle}")
        elif cmd == "/delch":
            await event.respond("🗑️ حُذفت" if channels.remove(rest) else "غير موجودة")

        elif m := SYMBOL.match(text):
            await analyse_and_reply(m.group(1).upper(), event)
        else:
            await event.respond("لم أفهم. أرسل رمز عملة مثل ETH، أو اضغط ❓ المساعدة", buttons=ui.MAIN_MENU)

    # ---------- inline buttons ----------
    @control.on(events.CallbackQuery(func=lambda e: e.sender_id == owner))
    async def on_button(event):  # noqa: ANN001
        data = event.data.decode()
        st = state.get()
        screens = {
            "set:main": ui.settings_main, "set:prov": ui.settings_providers, "set:src": ui.settings_sources,
            "set:notif": ui.settings_notify, "set:time": ui.settings_time,
            "set:tools": lambda: ui.settings_tools(s),
        }
        if data in screens:
            body, buttons = screens[data]()
            await event.edit(body, buttons=buttons)
        elif data.startswith("tg:"):
            ui.handle_toggle(data)
            back = {"prov": "set:prov", "tool": "set:tools", "src": "set:src", "notif": "set:notif"}[data.split(":")[1]]
            body, buttons = screens[back]()
            await event.edit(body, buttons=buttons)
        elif data.startswith("cy:"):
            ui.cycle(data[3:])
            body, buttons = ui.settings_time()
            await event.edit(body, buttons=buttons)
        elif data.startswith("del:"):
            _, kind, ident = data.split(":", 2)
            if kind == "ch":
                channels.remove(ident)
            elif kind == "watch":
                st["watchlist"] = [x for x in st["watchlist"] if x != ident]
            else:
                key = {"alert": "alerts", "trade": "trades", "rem": "reminders", "sch": "schedules"}[kind]
                st[key] = [x for x in st[key] if x["id"] != ident]
            state.save()
            await event.answer("🗑️ حُذف")
            view = {"ch": ui.view_channels, "watch": ui.view_watchlist, "alert": ui.view_alerts,
                    "trade": ui.view_trades, "rem": ui.view_reminders, "sch": ui.view_reminders}[kind]
            body, buttons = view()
            await event.edit(body, buttons=buttons)
        elif data.startswith("trade:"):
            plan = st["plans"].get(data[6:])
            if not plan:
                await event.answer("انتهت صلاحية هذه الخطة، أعد التحليل", alert=True)
                return
            st["trades"].append(new_trade(plan["symbol"], plan["entry"], plan["stop"], plan["tps"],
                                          await spot_price(plan["symbol"])))
            state.save()
            await event.answer(f"📌 أتابع {plan['symbol']}: دخول {plan['entry']} وقف {plan['stop']}", alert=True)
        elif data.startswith("watch:"):
            sym = data[6:]
            if sym not in st["watchlist"]:
                st["watchlist"].append(sym)
                state.save()
            await event.answer(f"⭐ {sym} في المراقبة")
        elif data.startswith("again:"):
            await event.answer("⏳")
            await analyse_and_reply(data[6:], event)

    # ---------- analyst channel posts about my coins ----------
    @user.on(events.NewMessage(incoming=True, func=lambda e: e.is_channel and not e.is_group))
    async def on_channel_post(event):  # noqa: ANN001
        st = state.get()
        if not st["notify"]["channel_posts"]:
            return
        chat = await event.get_chat()
        handle = (getattr(chat, "username", None) or "").lower()
        followed = channels.load()
        if handle not in followed:
            return
        text = event.raw_text or ""
        coins = [c for c in st["watchlist"] if channels.mentions(c, text)]
        category = news.classify(text)
        risky = category in ("🚨 خطر أمني", "🌍 سياسي/اقتصادي")
        if coins or risky:
            tag = ", ".join(coins) or category
            await notify(f"📢 @{handle} ({followed[handle]}) عن {tag}:\n\n{text[:1500]}\n\nhttps://t.me/{handle}/{event.id}")

    sched = Scheduler(notify, run_analysis, send_result)
    asyncio.create_task(sched.run())
    await notify("✅ البوت يعمل. اضغط ❓ المساعدة لرؤية كل الأوامر.", buttons=ui.MAIN_MENU)
    logging.info("ready")
    await asyncio.gather(user.run_until_disconnected(), control.run_until_disconnected())


if __name__ == "__main__":
    asyncio.run(main())
