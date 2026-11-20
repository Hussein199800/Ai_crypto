import asyncio

from bot360 import expert
from bot360.channels import mentions
from bot360.main import chunks
from bot360.market import ema, rsi, summarize_tf


def test_indicators():
    up = [float(i) for i in range(1, 60)]
    assert rsi(up) == 100.0
    assert abs(ema([2.0] * 30, 20) - 2.0) < 1e-9
    candles = [[0, c, c + 1, c - 1, c, 10] for c in up * 4]
    s = summarize_tf(candles)
    assert s["close"] == 59.0 and s["rsi14"] is not None


def test_channel_mentions():
    assert mentions("ETH", "دخول #ETH من 1600")
    assert mentions("ETH", "ETHUSDT long")
    assert mentions("eth", "$eth looks weak")
    assert not mentions("ETH", "ETHFI breakout")
    assert not mentions("OP", "TOP coins")


def test_chunks_split_long_text():
    parts = chunks("سطر\n" * 3000)
    assert len(parts) > 1 and all(len(p) <= 4001 for p in parts)


def test_build_input_contains_all_angles():
    txt = expert.build_input("ETH", 1622, {"SCALPING": "x"}, {"fundamentals": {"rank": 2}},
                             [{"channel": "a", "method": "Wyckoff", "text": "ETH"}], "rules")
    for marker in ("BOT 360", "SCALPING", "rank", "Wyckoff", "rules", "غير موثوقة"):
        assert marker in txt


def test_no_key_falls_back(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    assert asyncio.run(expert.ask_expert("x")) is None


def test_bad_key_is_handled_not_raised(monkeypatch):
    # Exercises the real SDK call shape: unknown kwargs would raise TypeError here.
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-invalid")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:9")
    real = expert.anthropic.AsyncAnthropic
    monkeypatch.setattr(expert.anthropic, "AsyncAnthropic", lambda: real(max_retries=0))
    assert asyncio.run(expert.ask_expert("x")) is None
