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


import httpx

from bot360 import providers
from bot360.providers import Verdict, parse_verdict

KEYS = ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "GEMINI_API_KEY", "OPENAI_API_KEY")


def _no_keys(mp):
    for k in KEYS:
        mp.delenv(k, raising=False)


def test_no_keys_falls_back_to_rules(monkeypatch):
    _no_keys(monkeypatch)
    assert asyncio.run(expert.ask_expert("x")) is None


def test_bad_claude_key_is_handled(monkeypatch):
    # Exercises the real SDK call shape: unknown kwargs would raise TypeError here.
    _no_keys(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-invalid")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:9")
    real = providers.anthropic.AsyncAnthropic
    monkeypatch.setattr(providers.anthropic, "AsyncAnthropic", lambda **kw: real(max_retries=0, **kw))
    assert asyncio.run(providers.ask_claude("s", "u")) is None


def _mock_http(monkeypatch, handler):
    real = httpx.AsyncClient
    monkeypatch.setattr(providers.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler), **kw))


def test_gemini_rest_parsing(monkeypatch):
    _no_keys(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    seen = {}

    def handler(req):
        seen["url"], seen["key"] = str(req.url), req.headers["x-goog-api-key"]
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "VOTE scalp=AVOID swing=WAIT conf=60\n🧠 الزبدة: انتظر"}]}}]})

    _mock_http(monkeypatch, handler)
    out = asyncio.run(providers.ask_gemini("s", "u"))
    assert "الزبدة" in out and ":generateContent" in seen["url"] and seen["key"] == "k"


def test_openai_rest_parsing(monkeypatch):
    _no_keys(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "k")

    def handler(req):
        assert req.headers["authorization"] == "Bearer k" and req.url.path == "/v1/responses"
        return httpx.Response(200, json={"output": [
            {"type": "web_search_call"},
            {"type": "message", "content": [{"type": "output_text", "text": "VOTE scalp=BUY swing=BUY conf=70\nنص"}]},
        ]})

    _mock_http(monkeypatch, handler)
    assert asyncio.run(providers.ask_openai("s", "u")).endswith("نص")


def test_provider_http_error_returns_none(monkeypatch):
    _no_keys(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    _mock_http(monkeypatch, lambda req: httpx.Response(401, json={"error": "bad key"}))
    assert asyncio.run(providers.ask_openai("s", "u")) is None


def test_parse_verdict():
    v = parse_verdict("X", "VOTE scalp=avoid swing=WAIT conf=65\n🧠 الزبدة: لا")
    assert (v.scalp, v.swing, v.conf) == ("AVOID", "WAIT", 65) and not v.text.startswith("VOTE")
    assert parse_verdict("X", "بدون تصويت").scalp is None


def test_single_expert_shows_its_text():
    out = expert.render_panel([Verdict("Gemini", "🧠 الزبدة: انتظر", "WAIT", "WAIT", 50)])
    assert "Gemini" in out and "انتظر" in out


def test_committee_majority_and_dissent():
    vs = [
        Verdict("Claude", "🧠 الزبدة: لا تشتري الآن", "AVOID", "WAIT", 70),
        Verdict("Gemini", "🧠 الزبدة: انتظر", "AVOID", "WAIT", 60),
        Verdict("ChatGPT", "🧠 الزبدة: اشترِ", "BUY", "BUY", 55),
    ]
    out = expert.render_panel(vs)
    assert "لجنة الخبراء (3)" in out
    assert "⚡ سكالب: 🔴 لا تشتري (2/3)" in out and "ChatGPT: 🟢 شراء" in out
    assert "متوسط الثقة: 62%" in out
    assert "التحليل الكامل (Claude)" in out and "اشترِ" in out


def test_tie_prefers_caution():
    vs = [Verdict("A", "t", "BUY", "BUY", 50), Verdict("B", "t", "AVOID", "AVOID", 50)]
    assert "🔴 لا تشتري" in expert.render_panel(vs).split("\n")[1]
