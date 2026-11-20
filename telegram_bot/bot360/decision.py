"""Combine the readings of several tools into one explicit spot decision."""

from __future__ import annotations

from dataclasses import dataclass, field

from .parser import ToolReading

NEAR = 0.012  # within 1.2% of a level counts as "at the level"


@dataclass
class Vote:
    tool: str
    score: float  # -1 .. +1
    reasons: list[str] = field(default_factory=list)


@dataclass
class Decision:
    horizon: str
    action: str  # "شراء" | "انتظار" | "لا تشتري / خفّف"
    score: float
    confidence: int
    entry: float | None
    stop: float | None
    targets: list[float]
    votes: list[Vote]


def vote_for(r: ToolReading, price: float | None) -> Vote | None:
    if not r.useful:
        return None
    pts: list[float] = []
    why: list[str] = []

    if price is not None:
        if r.pivot:
            if price > r.pivot:
                pts.append(1.0); why.append(f"فوق الارتكاز {fmt(r.pivot)}")
            else:
                pts.append(-1.0); why.append(f"تحت الارتكاز {fmt(r.pivot)}")
        h4, l4 = r.levels.get("H4"), r.levels.get("L4")
        if h4 and price > h4:
            pts.append(1.5); why.append(f"اختراق H4 {fmt(h4)}")
        if l4 and price < l4:
            pts.append(-1.5); why.append(f"كسر L4 {fmt(l4)}")
        sup = next((s for s in r.supports if s <= price), None)
        res = next((x for x in r.resistances if x >= price), None)
        if sup and (price - sup) / price <= NEAR:
            pts.append(0.5); why.append(f"قريب من دعم {fmt(sup)}")
        if res and (res - price) / price <= NEAR:
            pts.append(-0.5); why.append(f"قريب من مقاومة {fmt(res)}")

    if price is not None and r.stop:
        if price <= r.stop * 1.003:
            pts.append(-1.5); why.append(f"السعر عند/تحت وقف الأداة {fmt(r.stop)}")
        elif r.entry and price <= r.entry:
            pts.append(0.75); why.append(f"داخل منطقة الدخول {fmt(r.entry)}–{fmt(r.stop)}")
        elif r.entry:
            why.append(f"فوق منطقة الدخول {fmt(r.entry)} (انتظر تراجع)")

    if r.prob_up is not None and r.prob_down is not None:
        edge = (r.prob_up - r.prob_down) / 100
        pts.append(round(edge * 2.5, 2))
        why.append(f"ماركوف: صعود {r.prob_up:g}% / هبوط {r.prob_down:g}%")

    if price is not None and r.band_hi and r.band_lo and r.band_hi > r.band_lo:
        pos = (price - r.band_lo) / (r.band_hi - r.band_lo)
        if pos <= 0.2:
            pts.append(0.25); why.append("قرب الحد السفلي لنطاق GARCH")
        elif pos >= 0.8:
            pts.append(-0.25); why.append("قرب الحد العلوي لنطاق GARCH")

    # Wording is noisy, so it only counts when nothing structured was found.
    words = r.bull_words - r.bear_words
    if words and not pts:
        pts.append(0.5 if words > 0 else -0.5)
        why.append("لهجة الأداة إيجابية" if words > 0 else "لهجة الأداة سلبية")

    if not pts:
        return None
    score = max(-1.0, min(1.0, sum(pts) / 2.5))
    return Vote(r.tool, score, why)


def decide(horizon: str, readings: list[ToolReading], price: float | None) -> Decision:
    votes = [v for r in readings if (v := vote_for(r, price))]
    if not votes:
        return Decision(horizon, "انتظار", 0.0, 0, None, None, [], [])

    score = sum(v.score for v in votes) / len(votes)
    same_side = sum(1 for v in votes if v.score * score > 0) / len(votes)
    confidence = round(100 * min(1.0, abs(score) * 0.6 + same_side * 0.4)) if score else 0

    if score >= 0.25:
        action = "شراء"
    elif score <= -0.25:
        action = "لا تشتري / خفّف"
    else:
        action = "انتظار"

    entry = stop = None
    targets: list[float] = []
    if price is not None:
        supports = sorted({s for r in readings for s in r.supports if s < price}, reverse=True)
        resist = sorted({x for r in readings for x in r.resistances if x > price})
        entry = price if action == "شراء" and (not supports or (price - supports[0]) / price <= NEAR) else (supports[0] if supports else None)
        if entry is not None:
            below = [s for s in supports if s < entry * (1 - 0.003)]
            stop = round(below[0] * 0.995, 8) if below else round(entry * 0.97, 8)
        targets = resist[:3]

    return Decision(horizon, action, round(score, 2), confidence, entry, stop, targets, votes)


def fmt(x: float | None) -> str:
    if x is None:
        return "—"
    if x >= 100:
        return f"{x:,.2f}"
    if x >= 1:
        return f"{x:.4f}"
    return f"{x:.6g}"


ICON = {"شراء": "🟢", "انتظار": "⚪", "لا تشتري / خفّف": "🔴"}


def render(symbol: str, price: float | None, decisions: list[Decision], failed: list[str]) -> str:
    lines = [f"📊 قرار {symbol.upper()} (سبوت)", f"💵 السعر: {fmt(price)}", ""]
    for d in decisions:
        lines.append(f"━━ {d.horizon} ━━")
        lines.append(f"{ICON[d.action]} القرار: {d.action}")
        lines.append(f"🎯 الثقة: {d.confidence}%  |  الدرجة: {d.score:+.2f}")
        if d.action == "شراء":
            lines.append(f"↘️ الدخول: {fmt(d.entry)}")
            lines.append(f"🛑 الوقف: {fmt(d.stop)}")
            if d.targets:
                lines.append("✅ الأهداف: " + " / ".join(fmt(t) for t in d.targets))
        elif d.action == "انتظار" and d.entry:
            lines.append(f"⏳ منطقة شراء أفضل: {fmt(d.entry)}")
        for v in d.votes:
            mark = "🟢" if v.score > 0.1 else "🔴" if v.score < -0.1 else "⚪"
            lines.append(f"  {mark} {v.tool}: " + "، ".join(v.reasons))
        lines.append("")
    if failed:
        lines.append("⚠️ لم تُقرأ: " + ", ".join(failed))
    return "\n".join(lines).strip()
