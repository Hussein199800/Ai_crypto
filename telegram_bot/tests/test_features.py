import time

import pytest

from bot360 import journal, news, scheduler, state, ui
from bot360.expert import summarize
from bot360.providers import Verdict, parse_verdict


@pytest.fixture(autouse=True)
def fresh_state(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "FILE", tmp_path / "state.json")
    monkeypatch.setattr(state, "_data", None)
    monkeypatch.setattr(journal, "FILE", tmp_path / "decisions.jsonl")


# ---- alerts / trades ----

def test_price_alerts():
    assert scheduler.check_alert({"op": "<", "price": 1600}, 1599)
    assert not scheduler.check_alert({"op": "<", "price": 1600}, 1601)
    assert scheduler.check_alert({"op": ">", "price": 1800}, 1800)


def _trade(**kw):
    return {"symbol": "ETH", "entry": 1600, "stop": 1550, "tps": [1700, 1800], "state": "waiting", "hit": []} | kw


def test_trade_lifecycle():
    t = _trade()
    assert scheduler.check_trade(t, 1650) == []
    assert "منطقة الدخول" in scheduler.check_trade(t, 1601)[0] and t["state"] == "open"
    msgs = scheduler.check_trade(t, 1705)
    assert "الهدف 1" in msgs[0] and "ارفع الوقف" in msgs[0]
    assert scheduler.check_trade(t, 1710) == []  # no duplicate
    msgs = scheduler.check_trade(t, 1820)
    assert "الهدف 2" in msgs[0] and t["state"] == "closed"


def test_trade_stop_and_cancel():
    t = _trade(state="open")
    assert "ضرب الوقف" in scheduler.check_trade(t, 1540)[0] and t["state"] == "closed"
    w = _trade()
    assert "أُلغيت" in scheduler.check_trade(w, 1540)[0]


def test_decision_change():
    assert scheduler.decision_changed({"scalp": "WAIT", "swing": "WAIT"}, {"scalp": "BUY", "swing": "WAIT"})
    assert not scheduler.decision_changed({}, {"scalp": "BUY", "swing": "BUY"})
    assert not scheduler.decision_changed({"scalp": "BUY", "swing": "BUY"}, {"scalp": "BUY", "swing": "BUY"})


def test_btc_shock_with_cooldown():
    sh = scheduler.Shock()
    t0 = 1_000_000.0
    assert sh.feed(60000, 3, t0) is None
    assert sh.feed(58000, 3, t0 + 600) < -3
    assert sh.feed(57000, 3, t0 + 900) is None  # cooldown


# ---- time parsing ----

def test_parse_when_and_duration():
    assert state.parse_duration("3h") == 10800
    assert state.parse_duration("30m") == 1800
    assert state.parse_duration("2ي") == 172800
    assert abs(state.parse_when("1h") - time.time() - 3600) < 5
    future = state.parse_when("23:59")
    assert 0 < future - time.time() <= 86400
    assert state.parse_when("2030-01-01 09:00") > time.time()
    assert state.parse_when("غدًا") is None
    assert state.valid_hhmm("9:05") and not state.valid_hhmm("25:00")


# ---- settings ----

def test_toggles_persist():
    ui.handle_toggle("tg:prov:Gemini")
    ui.handle_toggle("tg:tool:PIVOT")
    ui.handle_toggle("tg:notif:news")
    st = state.get()
    assert st["providers"]["Gemini"] is False and "PIVOT" in st["tools_off"] and st["notify"]["news"] is False
    ui.handle_toggle("tg:tool:PIVOT")
    assert "PIVOT" not in state.get()["tools_off"]
    ui.cycle("watch")
    assert state.get()["watch_every_hours"] == 6
    state._data = None  # reload from disk
    assert state.get()["providers"]["Gemini"] is False


def test_settings_screens_render():
    for fn in (ui.settings_main, ui.settings_providers, ui.settings_sources, ui.settings_notify, ui.settings_time,
               ui.view_watchlist, ui.view_alerts, ui.view_trades, ui.view_reminders):
        text, _ = fn()
        assert text


# ---- news ----

RSS = """<rss><channel>
<item><title>Exchange XYZ hacked, $40M drained</title><link>https://n/1</link></item>
<item><title>SOL ETF approval expected</title><link>https://n/2</link></item>
<item><title>Weekly market wrap</title><link>https://n/3</link></item>
<item><title>Arbitrum team AMA recap for ARB holders</title><link>https://n/4</link></item>
</channel></rss>"""


def test_news_classification():
    items = news.parse_rss(RSS)
    assert len(items) == 4
    picked = news.pick(items, {"https://n/2"}, ["ARB"])
    cats = {p["link"]: p for p in picked}
    assert cats["https://n/1"]["category"] == "🚨 خطر أمني"
    assert "https://n/2" not in cats  # already seen
    assert "https://n/3" not in cats  # nothing interesting
    assert cats["https://n/4"]["coins"] == ["ARB"]
    assert news.classify("Fed signals rate hike") == "🌍 سياسي/اقتصادي"
    assert news.parse_rss("not xml") == []
    assert news.mentioned("Ethereum upgrade delayed", ["ETH", "SOL"]) == ["ETH"]
    assert news.mentioned("Ethereal Labs raises", ["ETH"]) == []


# ---- journal ----

def test_journal_review_grades():
    journal.record({"symbol": "ETH", "price": 1600, "swing": "BUY"})
    journal.record({"symbol": "SOL", "price": 100, "swing": "AVOID"})
    out = journal.review({"ETH": 1700, "SOL": 110})
    assert "ETH" in out and "✅" in out and "❌" in out and "1/2" in out


# ---- plan extraction ----

def test_vote_line_with_plan():
    v = parse_verdict("X", "VOTE scalp=WAIT swing=BUY conf=70 entry=1600.5 stop=1540 tp=1700/1850\nنص")
    assert (v.entry, v.stop, v.tps) == (1600.5, 1540.0, [1700.0, 1850.0])
    s = summarize([v, Verdict("Y", "t", "WAIT", "BUY", 50)])
    assert s["swing"] == "BUY" and s["entry"] == 1600.5 and s["conf"] == 60
