from bot360.decision import decide, render, vote_for
from bot360.parser import parse_reply
from tests.samples import PIVOT_SAMPLE, SCALPING_ETH


def test_scalping_reply_parsed():
    r = parse_reply("SCALPING", SCALPING_ETH)
    assert r.entry == 1653.6986
    assert r.stop == 1621.9331
    assert 1725.9271 in r.supports and 1603.1035 in r.supports
    assert (r.prob_up, r.prob_down) == (45.3, 54.7)
    assert (r.band_hi, r.band_lo) == (1642.2165, 1603.1035)
    assert abs(r.price - 1622.66) < 0.01  # centre of the 1SD band


def test_scalping_at_tool_stop_is_bearish():
    r = parse_reply("SCALPING", SCALPING_ETH)
    v = vote_for(r, r.price)
    assert v.score < 0
    assert any("وقف" in x for x in v.reasons)


def test_pivot_reply_parsed():
    r = parse_reply("PIVOT", PIVOT_SAMPLE)
    assert r.pivot == 0.3092
    assert r.levels["H4"] == 0.3318 and r.levels["L4"] == 0.2944
    assert r.levels["R1"] == 0.3222 and r.levels["S3"] == 0.2752


def test_pivot_votes_follow_price():
    r = parse_reply("PIVOT", PIVOT_SAMPLE)
    assert vote_for(r, 0.34).score > 0  # above H4 breakout
    assert vote_for(r, 0.29).score < 0  # below L4 break


def test_buy_decision_has_plan():
    r = parse_reply("PIVOT", PIVOT_SAMPLE)
    d = decide("سوينغ", [r], 0.335)
    assert d.action == "شراء"
    assert d.stop < d.entry and d.targets and d.targets[0] > 0.335
    text = render("XRP", 0.335, [d], [])
    assert "شراء" in text and "الوقف" in text


def test_no_data_means_wait():
    d = decide("سكالب", [parse_reply("X", "حدث خطأ")], 100)
    assert d.action == "انتظار" and d.confidence == 0
