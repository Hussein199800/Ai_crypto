"""Turn the free-text replies of the source bot into structured data.

The parser is deliberately generic: it extracts labelled price levels
(R1..R4, S1..S4, H1..H6, L1..L6, pivot), an optional current price and
counts bullish / bearish wording. Anything it cannot understand is kept
as raw text so it can still be shown to the user and logged for tuning.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩٫٬", "0123456789.,")
# Invisible bidi / formatting marks Telegram clients often insert.
_BIDI = re.compile("[‎‏‪-‮⁦-⁩؜]")

_NUM = r"(\d+(?:,\d{3})*(?:\.\d+)?|\d*\.\d+)"
_LEVEL = re.compile(r"\(?\b([RSHL])\s?([1-6])\b\)?\s*[:=]\s*" + _NUM, re.I)
_PIVOT = re.compile(r"(?:الارتكاز|نقطة الارتكاز|pivot(?: point)?|\bPP\b)\s*[:=]?\s*" + _NUM, re.I)
_PRICE = re.compile(r"(?:السعر الحالي|السعر|current price|price|last)\s*[:=]?\s*\$?\s*" + _NUM, re.I)

_DOLLAR = r"\$?\s*" + _NUM
# "3️⃣ بداية الدخول (-6.60%):\n$1,653.6986" -> named support levels
_NAMED_LEVEL = re.compile(r"([^\n:()]{3,40}?)\s*(?:\([^)]*\))?\s*:\s*\n?\s*\$\s*" + _NUM)
_PROB_UP = re.compile(r"(?:استمرار الصعود|احتمال الصعود|prob(?:ability)? up)\s*:?\s*" + _NUM + r"\s*%", re.I)
_PROB_DOWN = re.compile(r"(?:الانعكاس للهبوط|احتمال الهبوط|prob(?:ability)? down)\s*:?\s*" + _NUM + r"\s*%", re.I)
_BAND_HI = re.compile(r"الحد العلوي[^:\n]*:\s*" + _DOLLAR)
_BAND_LO = re.compile(r"الحد السفلي[^:\n]*:\s*" + _DOLLAR)

BULLISH = (
    "صاعد", "صعود", "صعودي", "ايجابي", "إيجابي", "شراء", "تجميع",
    "bullish", "buy", "long", "uptrend",
)
BEARISH = (
    "هابط", "هبوط", "هبوطي", "سلبي", "بيع", "تصريف", "تجنب",
    "bearish", "sell", "short", "downtrend",
)


def normalize(text: str) -> str:
    return _BIDI.sub("", text or "").translate(_ARABIC_DIGITS)


def _to_float(raw: str) -> float:
    return float(raw.replace(",", ""))


@dataclass
class ToolReading:
    tool: str
    raw: str
    levels: dict[str, float] = field(default_factory=dict)
    pivot: float | None = None
    price: float | None = None
    bull_words: int = 0
    bear_words: int = 0
    extra_supports: list[float] = field(default_factory=list)
    extra_resistances: list[float] = field(default_factory=list)
    entry: float | None = None  # entry suggested by the tool itself
    stop: float | None = None  # stop-loss suggested by the tool itself
    prob_up: float | None = None  # % chance next candle goes up
    prob_down: float | None = None
    band_hi: float | None = None  # statistical 1SD band (GARCH)
    band_lo: float | None = None

    @property
    def supports(self) -> list[float]:
        vals = [v for k, v in self.levels.items() if k[0] in "SL"] + self.extra_supports
        return sorted(set(vals), reverse=True)

    @property
    def resistances(self) -> list[float]:
        vals = [v for k, v in self.levels.items() if k[0] in "RH"] + self.extra_resistances
        return sorted(set(vals))

    @property
    def useful(self) -> bool:
        return bool(
            self.levels or self.pivot or self.extra_supports or self.prob_up is not None
            or self.band_hi or self.bull_words or self.bear_words
        )


def _count(words: tuple[str, ...], text: str) -> int:
    low = text.lower()
    return sum(len(re.findall(r"(?<!\w)" + re.escape(w.lower()) + r"(?!\w)", low)) for w in words)


def parse_reply(tool: str, text: str) -> ToolReading:
    clean = normalize(text)
    reading = ToolReading(tool=tool, raw=text)

    for letter, idx, num in _LEVEL.findall(clean):
        key = f"{letter.upper()}{idx}"
        # Keep the first occurrence: bots usually print the main table first.
        reading.levels.setdefault(key, _to_float(num))

    if m := _PIVOT.search(clean):
        reading.pivot = _to_float(m.group(1))
    if m := _PRICE.search(clean):
        reading.price = _to_float(m.group(1))

    for section in re.split(r"⸻|——|\n-{3,}", clean):
        low = section.lower()
        is_sup = "الدعم" in section or "support" in low
        is_res = "المقاومة" in section or "resist" in low
        if not (is_sup or is_res):
            continue
        for label, num in _NAMED_LEVEL.findall(section):
            val = _to_float(num)
            (reading.extra_supports if is_sup else reading.extra_resistances).append(val)
            if "وقف" in label or "stop" in label.lower():
                reading.stop = val
            elif "الدخول" in label or "entry" in label.lower():
                reading.entry = val

    if m := _PROB_UP.search(clean):
        reading.prob_up = float(m.group(1))
    if m := _PROB_DOWN.search(clean):
        reading.prob_down = float(m.group(1))
    if m := _BAND_HI.search(clean):
        reading.band_hi = _to_float(m.group(1))
        reading.extra_resistances.append(reading.band_hi)
    if m := _BAND_LO.search(clean):
        reading.band_lo = _to_float(m.group(1))
        reading.extra_supports.append(reading.band_lo)
    if reading.price is None and reading.band_hi and reading.band_lo:
        # the 1SD band is centred on the last close
        reading.price = round((reading.band_hi + reading.band_lo) / 2, 8)

    reading.bull_words = _count(BULLISH, clean)
    reading.bear_words = _count(BEARISH, clean)
    return reading
