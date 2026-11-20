from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

# Which BOT 360 buttons feed which horizon. Buttons in both lists count twice.
SCALP_TOOLS = ["SCALPING", "PIVOT", "DEMARK", "STATS"]
SWING_TOOLS = ["TREND", "SWING", "PIVOT", "MURREY", "SQ9", "CYCLE180", "G3", "G5", "G6"]


def _list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "").strip()
    return [x.strip() for x in raw.split(",") if x.strip()] if raw else default


@dataclass(frozen=True)
class Settings:
    api_id: int
    api_hash: str
    control_bot_token: str
    owner_id: int
    source_bot: str
    scalp_tools: list[str]
    swing_tools: list[str]
    reply_quiet_seconds: float
    reply_max_seconds: float
    pause_between_tools: float


def load() -> Settings:
    return Settings(
        api_id=int(os.environ["TG_API_ID"]),
        api_hash=os.environ["TG_API_HASH"],
        control_bot_token=os.environ["CONTROL_BOT_TOKEN"],
        owner_id=int(os.environ["OWNER_ID"]),
        source_bot=os.environ["SOURCE_BOT"],
        scalp_tools=_list("SCALP_TOOLS", SCALP_TOOLS),
        swing_tools=_list("SWING_TOOLS", SWING_TOOLS),
        reply_quiet_seconds=float(os.getenv("REPLY_QUIET_SECONDS", "4")),
        reply_max_seconds=float(os.getenv("REPLY_MAX_SECONDS", "45")),
        pause_between_tools=float(os.getenv("PAUSE_BETWEEN_TOOLS", "3")),
    )
