"""Drive the source bot from the user's own account (Telethon userbot).

Flow per tool: press the keyboard button (send its text) -> the bot asks
for a coin -> send the symbol -> collect every message / edit the bot
sends until it has been quiet for a few seconds.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path

from telethon import TelegramClient, events

log = logging.getLogger(__name__)
RAW_DIR = Path(__file__).resolve().parent.parent / "raw_replies"


class Collector:
    def __init__(self, client: TelegramClient, bot: str, quiet: float, max_wait: float, pause: float):
        self.client = client
        self.bot = bot
        self.quiet = quiet
        self.max_wait = max_wait
        self.pause = pause
        self._entity = None
        self._buffer: dict[int, str] = {}
        self._last_activity = 0.0
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        self._entity = await self.client.get_entity(self.bot)
        chat = self._entity.id

        @self.client.on(events.NewMessage(chats=chat, incoming=True))
        @self.client.on(events.MessageEdited(chats=chat, incoming=True))
        async def _on(event):  # noqa: ANN001
            self._buffer[event.message.id] = event.message.raw_text or ""
            self._last_activity = time.monotonic()

    async def _wait_quiet(self, first_timeout: float) -> list[str]:
        """Wait for at least one message, then until the chat is quiet."""
        start = time.monotonic()
        while not self._buffer and time.monotonic() - start < first_timeout:
            await asyncio.sleep(0.3)
        while self._buffer and time.monotonic() - self._last_activity < self.quiet:
            if time.monotonic() - start > self.max_wait:
                break
            await asyncio.sleep(0.3)
        msgs = [self._buffer[k] for k in sorted(self._buffer)]
        self._buffer = {}
        return msgs

    async def run_tool(self, tool: str, symbol: str) -> str:
        self._buffer = {}
        await self.client.send_message(self._entity, tool)
        await self._wait_quiet(first_timeout=15)  # the "send me the coin" prompt
        await self.client.send_message(self._entity, symbol.upper())
        replies = await self._wait_quiet(first_timeout=self.max_wait)
        text = "\n".join(r for r in replies if r.strip())
        self._save_raw(tool, symbol, text)
        return text

    async def run_many(self, tools: list[str], symbol: str) -> dict[str, str]:
        out: dict[str, str] = {}
        async with self._lock:  # one conversation with the source bot at a time
            for i, tool in enumerate(tools):
                if i:
                    await asyncio.sleep(self.pause)
                try:
                    out[tool] = await self.run_tool(tool, symbol)
                except Exception:  # keep going with the other tools
                    log.exception("tool %s failed", tool)
                    out[tool] = ""
        return out

    @staticmethod
    def _save_raw(tool: str, symbol: str, text: str) -> None:
        RAW_DIR.mkdir(exist_ok=True)
        path = RAW_DIR / f"{symbol.upper()}_{tool}_{int(time.time())}.json"
        path.write_text(json.dumps({"tool": tool, "symbol": symbol, "text": text}, ensure_ascii=False, indent=1))
