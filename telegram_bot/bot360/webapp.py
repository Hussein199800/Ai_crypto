"""Read the BOT 360 Mini App (the dark web interface inside Telegram).

The Mini App is a web page, not chat messages. We ask Telegram (with your
own account) for its signed launch URL, open it in a headless Chromium,
click a tool card by its title, type the coin and read what appears, plus
any JSON the page receives from its backend.

Needs:  pip install playwright  &&  playwright install chromium
(works on Windows / Mac / Linux / VPS; not inside Termux on Android).

Discovery (run once, then send me the files in webapp_discovery/):
    python -m bot360.webapp discover
    python -m bot360.webapp tool "Wyckoff Pro" ETH
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
import time
from pathlib import Path

from telethon import TelegramClient, functions

log = logging.getLogger(__name__)
OUT = Path(__file__).resolve().parent.parent / "webapp_discovery"
SUBMIT = re.compile(r"تحليل|حلل|ابدأ|بحث|إرسال|ارسال|تنفيذ|analy[sz]e|search|submit|start|go|run|scan", re.I)
SECRET = re.compile(r"(tgWebAppData|initData|hash|auth|token|signature)=[^&#\s\"']+", re.I)


def redact(text: str) -> str:
    """Never write the signed launch data / tokens to disk."""
    return SECRET.sub(r"\1=<hidden>", text)


async def launch_url(client: TelegramClient, bot: str) -> str:
    """Signed Mini App URL for this account (main app, else the menu button)."""
    entity = await client.get_input_entity(bot)
    try:
        res = await client(functions.messages.RequestMainWebViewRequest(
            peer=entity, bot=entity, platform="android"))
    except Exception as exc:  # bot without a "main" app -> menu-button web view
        log.info("main web view unavailable (%s), trying menu button", exc)
        res = await client(functions.messages.RequestWebViewRequest(
            peer=entity, bot=entity, platform="android", from_bot_menu=True))
    return res.url


async def _browser(pw):
    path = os.getenv("CHROMIUM_PATH")
    try:
        return await pw.chromium.launch(executable_path=path) if path else await pw.chromium.launch()
    except Exception:
        if Path("/opt/pw-browsers/chromium").exists():
            return await pw.chromium.launch(executable_path="/opt/pw-browsers/chromium")
        raise


async def _settle(page, max_wait: float = 45, stable_for: float = 3) -> str:
    """Wait until the page text stops changing (results often stream in)."""
    start, last, since = time.monotonic(), None, time.monotonic()
    while time.monotonic() - start < max_wait:
        try:
            text = await page.inner_text("body")
        except Exception:
            text = ""
        if text != last:
            last, since = text, time.monotonic()
        elif time.monotonic() - since >= stable_for:
            break
        await asyncio.sleep(0.7)
    return last or ""


def _clean(text: str, home: str) -> str:
    """Drop the menu lines that were already on the home screen."""
    home_lines = {ln.strip() for ln in home.splitlines()}
    out, seen = [], set()
    for ln in (x.strip() for x in text.splitlines()):
        if ln and ln not in home_lines and ln not in seen:
            out.append(ln)
            seen.add(ln)
    return "\n".join(out)


class MiniApp:
    """One browser session reused for several tools of one analysis."""

    def __init__(self, url: str):
        self.url = url
        self.home_text = ""
        self.json_seen: list[dict] = []

    async def __aenter__(self):
        from playwright.async_api import async_playwright

        self._pw = await async_playwright().start()
        self._browser = await _browser(self._pw)
        self._ctx = await self._browser.new_context(
            viewport={"width": 412, "height": 915}, is_mobile=True, has_touch=True, locale="ar")
        self.page = await self._ctx.new_page()
        self.page.on("response", self._on_response)
        await self.home()
        return self

    async def __aexit__(self, *exc):
        await self._browser.close()
        await self._pw.stop()

    async def _on_response(self, resp) -> None:
        try:
            if "json" in (resp.headers.get("content-type") or ""):
                body = await resp.text()
                self.json_seen.append({"url": redact(resp.url), "status": resp.status, "body": redact(body[:4000])})
        except Exception:
            pass

    async def home(self) -> None:
        await self.page.goto(self.url, wait_until="domcontentloaded", timeout=45000)
        self.home_text = await _settle(self.page, max_wait=20, stable_for=2)

    async def run_tool(self, title: str, symbol: str) -> str:
        """Open a tool card by its visible title, enter the coin, return the result text."""
        page = self.page
        await self.home()
        card = page.get_by_text(title, exact=False).first
        try:
            await card.scroll_into_view_if_needed(timeout=8000)
            await card.click(timeout=8000)
        except Exception:
            return f"(لم أجد أداة باسم «{title}» في التطبيق)"
        await asyncio.sleep(1.5)

        self.json_seen.clear()
        box = page.locator("input:visible, textarea:visible").first
        if await box.count():
            await box.fill(symbol)
            await box.press("Enter")
            await asyncio.sleep(0.8)
            buttons = page.locator("button:visible, [role=button]:visible")
            for i in range(min(await buttons.count(), 15)):
                b = buttons.nth(i)
                if SUBMIT.search((await b.inner_text()) or ""):
                    try:
                        await b.click(timeout=3000)
                    except Exception:
                        pass
                    break
        text = _clean(await _settle(page), self.home_text)
        if self.json_seen:
            raw = "\n".join(j["body"] for j in self.json_seen[-4:])
            text += "\n\n[بيانات JSON من التطبيق]\n" + raw[:6000]
        return text[:9000]


async def run_tools(client: TelegramClient, bot: str, tools: list[str], symbol: str) -> dict[str, str]:
    """Used by the analysis engine. Returns {tool title: result text}."""
    out: dict[str, str] = {}
    try:
        url = await launch_url(client, bot)
        async with MiniApp(url) as app:
            for t in tools:
                try:
                    out[f"APP:{t}"] = await app.run_tool(t, symbol)
                except Exception as exc:
                    log.exception("mini app tool %s failed", t)
                    out[f"APP:{t}"] = f"(خطأ: {exc})"
    except ImportError:
        log.error("playwright غير مثبت: pip install playwright && playwright install chromium")
    except Exception:
        log.exception("mini app session failed")
    return out


# ---------- discovery CLI ----------

async def _discover(args: list[str]) -> None:
    from . import config

    s = config.load()
    client = TelegramClient("user_session", s.api_id, s.api_hash)
    await client.start()
    OUT.mkdir(exist_ok=True)
    url = await launch_url(client, s.source_bot)
    print("✅ حصلت على رابط التطبيق:", redact(url.split("#")[0]))
    requests: list[dict] = []

    async with MiniApp(url) as app:
        app.page.on("request", lambda r: requests.append(
            {"method": r.method, "url": redact(r.url), "post": redact(r.post_data or "")[:1000]}))
        if args and args[0] == "tool" and len(args) >= 3:
            title, symbol = args[1], args[2]
            text = await app.run_tool(title, symbol)
            await app.page.screenshot(path=str(OUT / "tool.png"), full_page=True)
            (OUT / "tool.txt").write_text(redact(text), encoding="utf-8")
            print(text[:3000])
        else:
            await app.home()
            for _ in range(15):  # load every card
                await app.page.mouse.wheel(0, 1500)
                await asyncio.sleep(0.4)
            await app.page.screenshot(path=str(OUT / "home.png"), full_page=True)
            (OUT / "home.txt").write_text(redact(await app.page.inner_text("body")), encoding="utf-8")
            (OUT / "home.html").write_text(redact(await app.page.content()), encoding="utf-8")
        (OUT / "network.json").write_text(json.dumps(
            {"requests": requests[-200:], "json_responses": app.json_seen[-30:]},
            ensure_ascii=False, indent=1), encoding="utf-8")
    await client.disconnect()
    print(f"\n📁 الملفات في: {OUT}\n(الروابط الموقّعة والتوكنات محجوبة تلقائيًا)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_discover(sys.argv[1:]))
