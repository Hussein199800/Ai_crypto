"""Keyboards, settings menu and list screens for the control bot."""

from __future__ import annotations

from telethon import Button

from . import channels, config, state
from .decision import fmt
from .providers import PROVIDERS, has_key

MAIN_MENU = [
    [Button.text("📊 تحليل", resize=True), Button.text("⭐ المراقبة")],
    [Button.text("🔔 التنبيهات"), Button.text("💼 صفقاتي")],
    [Button.text("⏰ التذكيرات والجدولة"), Button.text("📜 السجل")],
    [Button.text("📢 القنوات"), Button.text("⚙️ الإعدادات")],
    [Button.text("❓ المساعدة")],
]

HELP = """📖 الأوامر

📊 التحليل
• ETH: تحليل كامل
• /watch ETH SOL: أضف إلى المراقبة (تنبيه عند تغيّر القرار + أخبارها)
• /unwatch ETH: احذف من المراقبة

🔔 تنبيهات السعر
• /alert ETH < 1600: نبّهني إذا نزل تحت 1600
• /alert ETH > 1800: نبّهني إذا صعد فوق 1800

💼 متابعة صفقة
• زر «📌 تابع الصفقة» تحت أي تحليل
• أو يدويًا: /trade ETH 1620 1580 1700 1750 (دخول، وقف، ثم الأهداف)

⏰ التذكيرات
• /remind 3h راجع صفقة SOL (أو 30m أو 2d)
• /remind 21:00 أغلق المراكز
• /remind 2026-12-01 09:00 فتح توكنات ARB

🗓️ الجدولة
• /every 4h ETH SOL: تحليل كل 4 ساعات
• /daily 09:00 BTC ETH: تحليل يومي بوقت محدد
• /summary 08:30: وقت الملخص اليومي

📢 القنوات
• /addch @channel وصف أسلوب المحلل ودقته
• /delch @channel

⚙️ عام
• /tz Asia/Riyadh: المنطقة الزمنية
• /settings: الإعدادات"""


def mark(on: bool) -> str:
    return "✅" if on else "❌"


# ---------- settings ----------

def settings_main() -> tuple[str, list]:
    return "⚙️ الإعدادات: اختر القسم", [
        [Button.inline("🤖 النماذج (الخبراء)", b"set:prov")],
        [Button.inline("🧰 أدوات BOT 360", b"set:tools")],
        [Button.inline("📡 مصادر التحليل", b"set:src")],
        [Button.inline("🔔 الإشعارات", b"set:notif")],
        [Button.inline("⏱️ التوقيت والفواصل", b"set:time")],
    ]


def _back() -> list:
    return [Button.inline("⬅️ رجوع", b"set:main")]


def settings_providers() -> tuple[str, list]:
    st = state.get()["providers"]
    rows = []
    for name in PROVIDERS:
        key = "" if has_key(name) else " (🔑 لا يوجد مفتاح)"
        rows.append([Button.inline(f"{mark(st.get(name, True))} {name}{key}", f"tg:prov:{name}".encode())])
    text = ("🤖 النماذج: اضغط للتشغيل أو الإطفاء.\n"
            "النموذج يعمل فقط إذا كان مفعّلًا وله مفتاح في ملف .env.\n"
            "واحد = خبير منفرد، وأكثر = لجنة تصوّت.")
    return text, rows + [_back()]


def settings_tools(s: config.Settings) -> tuple[str, list]:
    off = set(state.get()["tools_off"])
    tools = list(dict.fromkeys(s.scalp_tools + s.swing_tools))
    rows, row = [], []
    for t in tools:
        row.append(Button.inline(f"{mark(t not in off)} {t}", f"tg:tool:{t}".encode()))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    text = "🧰 أدوات BOT 360: الأداة المطفأة لا تُضغط، فيصبح التحليل أسرع."
    return text, rows + [_back()]


SOURCE_NAMES = {
    "bot360": "🤖 BOT 360", "technicals": "📉 فني مستقل (Binance)", "fundamentals": "🏦 أساسيات (CoinGecko)",
    "market": "🌍 حالة السوق العام", "channels": "📢 قنوات المحللين",
}
NOTIFY_NAMES = {
    "decision_change": "🔄 تغيّر قرار عملات المراقبة", "channel_posts": "📢 منشورات القنوات عن عملاتي",
    "news": "📰 أخبار: اختراقات، سياسة، فرص", "market_shock": "⚡ حركة عنيفة لـ BTC",
    "daily_summary": "☀️ الملخص اليومي",
}


def settings_sources() -> tuple[str, list]:
    st = state.get()["sources"]
    rows = [[Button.inline(f"{mark(st[k])} {v}", f"tg:src:{k}".encode())] for k, v in SOURCE_NAMES.items()]
    return "📡 مصادر التحليل: ما الذي يقرؤه الخبير قبل القرار.", rows + [_back()]


def settings_notify() -> tuple[str, list]:
    st = state.get()["notify"]
    rows = [[Button.inline(f"{mark(st[k])} {v}", f"tg:notif:{k}".encode())] for k, v in NOTIFY_NAMES.items()]
    return "🔔 الإشعارات التلقائية:", rows + [_back()]


WATCH_CYCLE = [1, 2, 4, 6, 12, 24]
SHOCK_CYCLE = [2.0, 3.0, 5.0, 8.0]


def settings_time() -> tuple[str, list]:
    st = state.get()
    text = (f"⏱️ التوقيت\n"
            f"• المنطقة الزمنية: {st['tz']} (للتغيير: /tz Asia/Riyadh)\n"
            f"• الملخص اليومي: {st['summary_time']} (للتغيير: /summary 08:30)\n"
            f"• فحص تغيّر القرار كل: {st['watch_every_hours']} ساعة\n"
            f"• حد الحركة العنيفة لـ BTC خلال ساعة: {st['shock_pct']}%\n\n"
            f"⚠️ كل فحص تغيّر قرار هو تحليل كامل يستهلك مفاتيح الذكاء الاصطناعي.")
    return text, [
        [Button.inline(f"🔄 فحص القرار: كل {st['watch_every_hours']}س (اضغط للتغيير)", b"cy:watch")],
        [Button.inline(f"⚡ حد الحركة: {st['shock_pct']}% (اضغط للتغيير)", b"cy:shock")],
        _back(),
    ]


def handle_toggle(data: str) -> None:
    st = state.get()
    _, kind, key = data.split(":", 2)
    if kind == "prov":
        st["providers"][key] = not st["providers"].get(key, True)
    elif kind == "tool":
        off = st["tools_off"]
        off.remove(key) if key in off else off.append(key)
    elif kind == "src":
        st["sources"][key] = not st["sources"][key]
    elif kind == "notif":
        st["notify"][key] = not st["notify"][key]
    state.save()


def cycle(name: str) -> None:
    st = state.get()
    if name == "watch":
        cur = st["watch_every_hours"]
        st["watch_every_hours"] = WATCH_CYCLE[(WATCH_CYCLE.index(cur) + 1) % len(WATCH_CYCLE)] if cur in WATCH_CYCLE else 4
    elif name == "shock":
        cur = st["shock_pct"]
        st["shock_pct"] = SHOCK_CYCLE[(SHOCK_CYCLE.index(cur) + 1) % len(SHOCK_CYCLE)] if cur in SHOCK_CYCLE else 3.0
    state.save()


# ---------- list screens ----------

def _del(kind: str, ident: str, label: str) -> list:
    return [Button.inline(f"🗑️ {label}", f"del:{kind}:{ident}".encode())]


def view_watchlist() -> tuple[str, list | None]:
    wl = state.get()["watchlist"]
    if not wl:
        return "⭐ قائمة المراقبة فارغة.\nأضف: /watch ETH SOL", None
    last = state.get()["last_decision"]
    lines = ["⭐ المراقبة (تنبيه عند تغيّر القرار + الأخبار والقنوات):"]
    for s in wl:
        d = last.get(s, {})
        lines.append(f"• {s}: سكالب {d.get('scalp', '—')} | سوينغ {d.get('swing', '—')}")
    return "\n".join(lines), [_del("watch", s, s) for s in wl]


def view_alerts() -> tuple[str, list | None]:
    al = state.get()["alerts"]
    if not al:
        return "🔔 لا توجد تنبيهات سعر.\nأضف: /alert ETH < 1600", None
    return "🔔 تنبيهات السعر:", [_del("alert", a["id"], f"{a['symbol']} {a['op']} {fmt(a['price'])}") for a in al]


STATE_NAMES = {"waiting": "⏳ بانتظار الدخول", "open": "🟢 مفتوحة", "closed": "⚪ مغلقة"}


def view_trades() -> tuple[str, list | None]:
    tr = [t for t in state.get()["trades"] if t["state"] != "closed"]
    if not tr:
        return "💼 لا توجد صفقات متابعة.\nاضغط «📌 تابع الصفقة» تحت أي تحليل، أو /trade ETH 1620 1580 1700", None
    lines = ["💼 الصفقات المتابعة:"]
    for t in tr:
        tps = " / ".join(fmt(x) for x in t["tps"]) or "—"
        lines.append(f"• {t['symbol']}: {STATE_NAMES[t['state']]} | دخول {fmt(t['entry'])} | وقف {fmt(t['stop'])} | أهداف {tps}")
    return "\n".join(lines), [_del("trade", t["id"], f"إيقاف متابعة {t['symbol']}") for t in tr]


def view_reminders() -> tuple[str, list | None]:
    st = state.get()
    lines, buttons = [], []
    if st["reminders"]:
        lines.append("⏰ التذكيرات:")
        for r in sorted(st["reminders"], key=lambda r: r["at"]):
            lines.append(f"• {state.fmt_ts(r['at'])}: {r['text']}")
            buttons.append(_del("rem", r["id"], r["text"][:25]))
    if st["schedules"]:
        lines.append("\n🗓️ التحليلات المجدولة:")
        for sc in st["schedules"]:
            when = f"كل {sc['hours']} ساعة" if sc["kind"] == "every" else f"يوميًا {sc['time']}"
            lines.append(f"• {' '.join(sc['symbols'])}: {when}")
            buttons.append(_del("sch", sc["id"], f"{' '.join(sc['symbols'])} ({when})"))
    if not lines:
        return "⏰ لا توجد تذكيرات أو جدولة.\n/remind 3h نص التذكير\n/every 4h ETH\n/daily 09:00 BTC", None
    lines.append(f"\n☀️ الملخص اليومي: {st['summary_time']} ({mark(st['notify']['daily_summary'])})")
    return "\n".join(lines), buttons


def view_channels() -> tuple[str, list | None]:
    data = channels.load()
    if not data:
        return "📢 لا توجد قنوات.\nأضف: /addch @channel وصف أسلوب المحلل", None
    lines = ["📢 قنوات المحللين:"] + [f"• @{k}: {v}" for k, v in data.items()]
    return "\n".join(lines), [_del("ch", k, f"@{k}") for k in data]


def analysis_buttons(symbol: str, plan_id: str | None) -> list:
    row = []
    if plan_id:
        row.append(Button.inline("📌 تابع الصفقة", f"trade:{plan_id}".encode()))
    if symbol not in state.get()["watchlist"]:
        row.append(Button.inline("⭐ راقب", f"watch:{symbol}".encode()))
    return [row, [Button.inline("🔁 أعد التحليل", f"again:{symbol}".encode())]] if row else \
        [[Button.inline("🔁 أعد التحليل", f"again:{symbol}".encode())]]
