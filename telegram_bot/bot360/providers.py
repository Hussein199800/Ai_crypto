"""AI providers. Each one is used only when its key is set in .env.

Claude goes through the official Anthropic SDK; Gemini and OpenAI use their
REST APIs directly through httpx, so no extra packages are needed.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from dataclasses import dataclass

import httpx

try:  # optional: not installable on Termux (needs Rust to build pydantic-core)
    import anthropic
except ImportError:  # pragma: no cover
    anthropic = None

log = logging.getLogger(__name__)
VOTE = re.compile(r"VOTE\s+scalp=(BUY|WAIT|AVOID)\s+swing=(BUY|WAIT|AVOID)(?:\s+conf=(\d{1,3}))?[^\n]*", re.I)
_PLAN_NUM = r"=\s*([\d.]+)"
TIMEOUT = float(os.getenv("AI_TIMEOUT_SECONDS", "240"))


@dataclass
class Verdict:
    provider: str
    text: str
    scalp: str | None = None
    swing: str | None = None
    conf: int | None = None
    entry: float | None = None
    stop: float | None = None
    tps: list[float] | None = None


def parse_verdict(provider: str, raw: str) -> Verdict:
    m = VOTE.search(raw)
    text = VOTE.sub("", raw, count=1).strip() if m else raw.strip()
    if not m:
        return Verdict(provider, text)
    conf = int(m.group(3)) if m.group(3) else None
    line = m.group(0)

    def num(key: str) -> float | None:
        x = re.search(key + _PLAN_NUM, line, re.I)
        try:
            return float(x.group(1).rstrip(".")) if x else None
        except ValueError:
            return None

    tp = re.search(r"tp=([\d.,/]+)", line, re.I)
    tps = [float(t) for t in re.split(r"[/,]", tp.group(1)) if re.fullmatch(r"\d+(?:\.\d+)?", t)] if tp else None
    return Verdict(provider, text, m.group(1).upper(), m.group(2).upper(), conf,
                   num("entry"), num("stop"), tps or None)


# ---------- Claude ----------

async def ask_claude(system: str, user: str) -> str | None:
    if anthropic is None or not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")):
        return None
    client = anthropic.AsyncAnthropic(timeout=TIMEOUT)
    messages: list = [{"role": "user", "content": user}]
    try:
        for _ in range(4):  # web search may pause a long turn; resume it
            resp = await client.beta.messages.create(
                model=os.getenv("CLAUDE_MODEL", "claude-opus-5-5"),
                max_tokens=16000,
                system=system,
                thinking={"type": "adaptive"},
                output_config={"effort": os.getenv("CLAUDE_EFFORT", "high")},
                tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 3}],
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                messages=messages,
            )
            if resp.stop_reason != "pause_turn":
                break
            messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason == "refusal":
            log.warning("Claude refused: %s", resp.stop_details)
            return None
        return "".join(b.text for b in resp.content if b.type == "text").strip() or None
    except anthropic.AuthenticationError:
        log.error("Claude: ANTHROPIC_API_KEY غير صالح")
    except anthropic.RateLimitError:
        log.warning("Claude: rate limited")
    except anthropic.APIStatusError as exc:
        log.error("Claude API error %s: %s", exc.status_code, exc.message)
    except anthropic.APIConnectionError:
        log.error("Claude: cannot reach the API")
    return None


# ---------- Gemini ----------

async def ask_gemini(system: str, user: str) -> str | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
    }
    # Google Search grounding is a paid-tier feature; opt in via .env.
    with_search = os.getenv("GEMINI_SEARCH", "0") == "1"
    async with httpx.AsyncClient(timeout=TIMEOUT) as http:
        for search in ([True, False] if with_search else [False]):
            payload = dict(body, tools=[{"google_search": {}}]) if search else body
            try:
                r = await http.post(url, json=payload, headers={"x-goog-api-key": key})
            except httpx.HTTPError as exc:
                log.error("Gemini: %s", exc)
                return None
            if r.status_code == 200:
                parts = (r.json().get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                return "".join(p.get("text", "") for p in parts).strip() or None
            log.error("Gemini %s: %s", r.status_code, r.text[:300])
    return None


# ---------- OpenAI (ChatGPT) ----------

async def ask_openai(system: str, user: str) -> str | None:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    body = {
        "model": os.getenv("OPENAI_MODEL", "gpt-6.2-sol"),
        "instructions": system,
        "input": user,
        "tools": [{"type": "web_search"}],
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as http:
        try:
            r = await http.post("https://api.openai.com/v1/responses", json=body,
                                headers={"Authorization": f"Bearer {key}"})
        except httpx.HTTPError as exc:
            log.error("OpenAI: %s", exc)
            return None
    if r.status_code != 200:
        log.error("OpenAI %s: %s", r.status_code, r.text[:300])
        return None
    texts = [
        c.get("text", "")
        for item in r.json().get("output", []) if item.get("type") == "message"
        for c in item.get("content", []) if c.get("type") == "output_text"
    ]
    return "".join(texts).strip() or None


PROVIDERS = {"Claude": ask_claude, "Gemini": ask_gemini, "ChatGPT": ask_openai}


KEY_ENV = {"Claude": ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"), "Gemini": ("GEMINI_API_KEY",),
           "ChatGPT": ("OPENAI_API_KEY",)}


def has_key(name: str) -> bool:
    if name == "Claude" and anthropic is None:
        return False
    return any(os.getenv(k) for k in KEY_ENV[name])


async def ask_all(system: str, user: str, enabled: set[str] | None = None) -> list[Verdict]:
    """Ask every enabled provider that has a key, in parallel; keep the answers."""
    names = [n for n in PROVIDERS if (enabled is None or n in enabled) and has_key(n)]
    answers = await asyncio.gather(*(PROVIDERS[n](system, user) for n in names), return_exceptions=True)
    out = []
    for name, ans in zip(names, answers):
        if isinstance(ans, Exception):
            log.exception("%s crashed", name, exc_info=ans)
        elif ans:
            out.append(parse_verdict(name, ans))
    return out
