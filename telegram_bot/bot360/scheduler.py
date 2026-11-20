"""Background loop: price alerts, trade follow-up, reminders, scheduled
analyses, decision-change watch, daily summary, BTC shocks and news."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Awaitable, Callable

import httpx

from . import news, state
from .decision import fmt
from .journal import NAMES
from .market import _get
from .price import spot_prices, tickers_24h

log = logging.getLogger(__name__)
Notify = Callable[..., Awaitable[None]]
Analyse = Callable[[str], Awaitable["object"]]  # returns engine.Result

NEWS_EVERY = 600
SHOCK_COOLDOWN = 7200


# ---------- pure checks (unit-tested) ----------

def check_alert(alert: dict, price: float) -> bool:
    return price <= alert["price"] if alert["op"] == "<" else price >= alert["price"]


def check_trade(trade: dict, price: float) -> list[str]:
    """Advance a spot trade; returns notification lines (trade is mutated)."""
    msgs: list[str] = []
    sym, st = trade["symbol"], trade["state"]
    if st == "waiting":
        if price <= trade["stop"]:
            trade["state"] = "closed"
            msgs.append(f"⚠️ {sym} كسر الوقف {fmt(trade['stop'])} قبل الدخول، فأُلغيت الصفقة.")
        elif price <= trade["entry"] * 1.003:
            trade["state"] = "open"
            msgs.append(f"✅ {sym} وصل منطقة الدخول {fmt(trade['entry'])} (السعر {fmt(price)}). الوقف {fmt(trade['stop'])}.")
    elif st == "open":
        if price <= trade["stop"]:
            trade["state"] = "closed"
            msgs.append(f"🛑 {sym} ضرب الوقف {fmt(trade['stop'])} (السعر {fmt(price)}).")
        else:
            for i, tp in enumerate(trade["tps"]):
                if i not in trade["hit"] and price >= tp:
                    trade["hit"].append(i)
                    pnl = (tp / trade["entry"] - 1) * 100
                    msgs.append(f"🎯 {sym} حقق الهدف {i + 1}: {fmt(tp)} ({pnl:+.1f}%)."
                                + (" 💡 ارفع الوقف إلى سعر الدخول." if i == 0 and len(trade["tps"]) > 1 else ""))
            if trade["tps"] and len(trade["hit"]) == len(trade["tps"]):
                trade["state"] = "closed"
                msgs.append(f"🏁 {sym} حقق كل الأهداف. أُغلقت المتابعة.")
    return msgs


def decision_changed(old: dict | None, new: dict) -> bool:
    return bool(old) and (old.get("scalp"), old.get("swing")) != (new.get("scalp"), new.get("swing"))


class Shock:
    def __init__(self) -> None:
        self.hist: deque[tuple[float, float]] = deque()
        self.last_alert = 0.0

    def feed(self, price: float, pct_limit: float, now: float | None = None) -> float | None:
        now = now or time.time()
        self.hist.append((now, price))
        while self.hist and now - self.hist[0][0] > 3600:
            self.hist.popleft()
        base = self.hist[0][1]
        change = (price / base - 1) * 100
        if abs(change) >= pct_limit and now - self.last_alert > SHOCK_COOLDOWN and now - self.hist[0][0] >= 300:
            self.last_alert = now
            return change
        return None


# ---------- the loop ----------

class Scheduler:
    def __init__(self, notify: Notify, analyse: Analyse, on_result: Callable[[object], Awaitable[None]]):
        self.notify = notify
        self.analyse = analyse
        self.on_result = on_result  # sends an analysis with its buttons
        self.shock = Shock()
        self.last_news = 0.0
        self.busy = False  # one background analysis batch at a time
        self.news_primed = False

    async def run(self) -> None:
        while True:
            for job in (self.prices, self.reminders, self.summary, self.news_tick):
                try:
                    await job()
                except Exception:
                    log.exception("scheduler job %s failed", job.__name__)
            if not self.busy:
                asyncio.create_task(self.analysis_jobs())
            await asyncio.sleep(60)

    async def prices(self) -> None:
        st = state.get()
        open_trades = [t for t in st["trades"] if t["state"] != "closed"]
        symbols = {a["symbol"] for a in st["alerts"]} | {t["symbol"] for t in open_trades} | {"BTC"}
        prices = await spot_prices(sorted(symbols))
        changed = False

        for a in list(st["alerts"]):
            p = prices.get(a["symbol"])
            if p is not None and check_alert(a, p):
                st["alerts"].remove(a)
                changed = True
                arrow = "⬇️" if a["op"] == "<" else "⬆️"
                await self.notify(f"🔔 {arrow} {a['symbol']} وصل {fmt(p)} (التنبيه: {a['op']} {fmt(a['price'])})")

        for t in open_trades:
            p = prices.get(t["symbol"])
            if p is not None:
                for m in check_trade(t, p):
                    changed = True
                    await self.notify(m)

        if st["notify"]["market_shock"] and "BTC" in prices:
            ch = self.shock.feed(prices["BTC"], st["shock_pct"])
            if ch is not None:
                await self.notify(f"⚡ حركة عنيفة: BTC {ch:+.1f}% خلال أقل من ساعة (الآن {fmt(prices['BTC'])}). "
                                  "راجع صفقاتك المفتوحة.")
        if changed:
            st["trades"] = [t for t in st["trades"] if t["state"] != "closed"]
            state.save()

    async def reminders(self) -> None:
        st = state.get()
        due = [r for r in st["reminders"] if r["at"] <= time.time()]
        for r in due:
            st["reminders"].remove(r)
            await self.notify(f"⏰ تذكير: {r['text']}")
        if due:
            state.save()

    async def summary(self) -> None:
        st = state.get()
        now = state.now_local()
        today = now.strftime("%Y-%m-%d")
        if not st["notify"]["daily_summary"] or st["last_summary_date"] == today:
            return
        if now.strftime("%H:%M") < st["summary_time"]:
            return
        st["last_summary_date"] = today
        state.save()
        await self.notify(await build_summary())

    async def news_tick(self) -> None:
        st = state.get()
        if time.time() - self.last_news < NEWS_EVERY:
            return
        self.last_news = time.time()
        items = await news.fetch_all()
        seen = set(st["news_seen"])
        fresh = news.pick(items, seen, st["watchlist"]) if self.news_primed or seen else []
        self.news_primed = True
        st["news_seen"] = (st["news_seen"] + [i["link"] for i in items if i["link"] not in seen])[-500:]
        state.save()
        if not st["notify"]["news"]:
            return
        for it in fresh[:5]:
            coins = f" [{', '.join(it['coins'])}]" if it["coins"] else ""
            await self.notify(f"{it['category']}{coins}\n{it['title']}\n{it['link']}")

    async def analysis_jobs(self) -> None:
        self.busy = True
        try:
            st = state.get()
            now = time.time()
            # 1) user schedules: always send the analysis
            for sc in st["schedules"]:
                due = False
                if sc["kind"] == "every" and now >= sc.get("next", 0):
                    sc["next"] = now + sc["hours"] * 3600
                    due = True
                elif sc["kind"] == "daily":
                    loc = state.now_local()
                    if loc.strftime("%H:%M") >= sc["time"] and sc.get("last_date") != loc.strftime("%Y-%m-%d"):
                        sc["last_date"] = loc.strftime("%Y-%m-%d")
                        due = True
                if due:
                    state.save()
                    for sym in sc["symbols"]:
                        await self.on_result(await self.analyse(sym), "🗓️ تحليل مجدول")
            # 2) watchlist: message only when the decision changes
            if st["notify"]["decision_change"] and st["watchlist"] and \
                    now - st["last_watch_run"] >= st["watch_every_hours"] * 3600:
                st["last_watch_run"] = now
                state.save()
                for sym in list(st["watchlist"]):
                    old = dict(st["last_decision"].get(sym, {}))
                    res = await self.analyse(sym)
                    if decision_changed(old, res.summary):
                        await self.on_result(res, (
                            f"🔄 تغيّر قرار {sym}: سكالب {NAMES.get(old.get('scalp'))} ← {NAMES.get(res.summary.get('scalp'))}"
                            f" | سوينغ {NAMES.get(old.get('swing'))} ← {NAMES.get(res.summary.get('swing'))}"))
        except Exception:
            log.exception("analysis job failed")
        finally:
            self.busy = False


async def build_summary() -> str:
    st = state.get()
    syms = sorted(set(st["watchlist"]) | {"BTC", "ETH"})
    tick = await tickers_24h(syms)
    async with httpx.AsyncClient(timeout=10) as http:
        fng = await _get(http, "https://api.alternative.me/fng/", limit=1)
    lines = [f"☀️ ملخص {state.now_local().strftime('%Y-%m-%d')}"]
    if fng and fng.get("data"):
        lines.append(f"😨 الخوف والطمع: {fng['data'][0]['value']} ({fng['data'][0]['value_classification']})")
    for s in syms:
        t = tick.get(s)
        if t:
            d = st["last_decision"].get(s, {})
            dec = f" | آخر قرار سوينغ: {NAMES.get(d.get('swing'))}" if d else ""
            lines.append(f"• {s}: {fmt(t['price'])} ({t['change_pct']:+.1f}% / 24س){dec}")
    trades = [t for t in st["trades"] if t["state"] != "closed"]
    if trades:
        lines.append("\n💼 الصفقات: " + "، ".join(f"{t['symbol']} ({t['state']})" for t in trades))
    end_of_day = time.time() + 86400
    rems = [r for r in st["reminders"] if r["at"] <= end_of_day]
    if rems:
        lines.append("⏰ تذكيرات اليوم: " + "، ".join(r["text"] for r in rems))
    return "\n".join(lines)
