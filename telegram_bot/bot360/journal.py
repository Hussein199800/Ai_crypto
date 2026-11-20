"""Decision log: every analysis is appended, and /log reviews how each
decision played out against today's price."""

from __future__ import annotations

import json
import time
from pathlib import Path

from .decision import fmt
from .state import fmt_ts

FILE = Path(__file__).resolve().parent.parent / "decisions.jsonl"
NAMES = {"BUY": "🟢 شراء", "WAIT": "⚪ انتظار", "AVOID": "🔴 لا تشتري", None: "—"}


def record(entry: dict) -> None:
    entry = dict(entry, ts=time.time())
    with FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def recent(n: int = 15) -> list[dict]:
    try:
        lines = FILE.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return []
    return [json.loads(x) for x in lines[-n:]]


def grade(decision: str | None, change_pct: float) -> str:
    """Was the swing call right? Buy should rise, avoid should fall."""
    if decision == "BUY":
        return "✅" if change_pct > 1 else "❌" if change_pct < -1 else "➖"
    if decision == "AVOID":
        return "✅" if change_pct < -1 else "❌" if change_pct > 1 else "➖"
    return "➖"


def review(prices: dict[str, float]) -> str:
    rows = recent()
    if not rows:
        return "📜 السجل فارغ. أي تحليل تطلبه يُحفظ هنا تلقائيًا."
    out = ["📜 آخر القرارات (سوينغ) وما حدث بعدها:"]
    score = [0, 0]
    for r in reversed(rows):
        now = prices.get(r["symbol"])
        line = f"• {fmt_ts(r['ts'])} {r['symbol']} @ {fmt(r.get('price'))}: {NAMES.get(r.get('swing'))}"
        if now and r.get("price"):
            ch = (now / r["price"] - 1) * 100
            g = grade(r.get("swing"), ch)
            line += f" → الآن {fmt(now)} ({ch:+.1f}%) {g}"
            if g in "✅❌":
                score[0 if g == "✅" else 1] += 1
        out.append(line)
    if sum(score):
        out.append(f"\n🎯 الدقة: {score[0]}/{sum(score)} ({round(100 * score[0] / sum(score))}%)")
    return "\n".join(out)
