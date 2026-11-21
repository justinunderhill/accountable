"""Business rules as pure functions, with no database.

Stages, probabilities, open and late, expected revenue, what a stage change
does, card reordering and funnel counting all live here, so the API, the
dashboard and the seed agree.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta

STAGES = ("new", "qualified", "proposal", "negotiation", "won", "lost")
OPEN_STAGES = ("new", "qualified", "proposal", "negotiation")
CLOSED_STAGES = ("won", "lost")
FUNNEL_STAGES = ("new", "qualified", "proposal", "negotiation", "won")
STAGE_NAMES = {
    "new": "New",
    "qualified": "Qualified",
    "proposal": "Proposal",
    "negotiation": "Negotiation",
    "won": "Won",
    "lost": "Lost",
}
DEFAULT_PROBABILITY = {
    "new": 10,
    "qualified": 25,
    "proposal": 50,
    "negotiation": 75,
    "won": 100,
    "lost": 0,
}
STATUSES = ("lead", "qualified", "customer")
ACTIVITY_TYPES = ("note", "call", "email")
COMING_UP_DAYS = 7


def _iso(day: date | str) -> str:
    return day if isinstance(day, str) else day.isoformat()


def is_open(stage: str) -> bool:
    return stage in OPEN_STAGES


def is_late(stage: str, close_date: str, today: date | str) -> bool:
    """An open deal whose close date is before today."""
    return is_open(stage) and close_date < _iso(today)


def expected_cents(value_cents: int, probability: int) -> int:
    """Value times probability of close. Whole dollars times a whole percentage is whole cents."""
    return value_cents * probability // 100


def stage_change(
    old_stage: str,
    new_stage: str,
    today: date | str,
    probability: int | None = None,
    close_date: str | None = None,
) -> dict:
    """The fields a stage change sets, beyond the stage itself.

    The probability resets to the new stage's usual figure unless one is given
    with the change. Moving into Won or Lost sets the close date to today unless
    one is given. Leaving Won or Lost keeps the close date. No change, no updates.
    """
    if new_stage == old_stage:
        return {}
    updates: dict = {
        "stage": new_stage,
        "probability": DEFAULT_PROBABILITY[new_stage] if probability is None else probability,
    }
    if close_date is not None:
        updates["close_date"] = close_date
    elif new_stage in CLOSED_STAGES:
        updates["close_date"] = _iso(today)
    return updates


def reorder(
    columns: dict[str, Sequence[int]], deal_id: int, to_stage: str, index: int
) -> dict[str, list[int]]:
    """Take a card out of its column and insert it at `index` in `to_stage`.

    `index` counts within the target column after the card has been taken out,
    so it is the card's final place. It is clamped to the column. Returns every
    column, each as a new list.
    """
    result = {stage: [d for d in ids if d != deal_id] for stage, ids in columns.items()}
    target = result.setdefault(to_stage, [])
    index = max(0, min(index, len(target)))
    target.insert(index, deal_id)
    return result


@dataclass
class FunnelDeal:
    stage: str
    value_cents: int
    # (from_stage, to_stage) pairs from the deal's stage history.
    history: list[tuple[str, str]] = field(default_factory=list)


def furthest_open_stage(deal: FunnelDeal) -> int:
    """The index in OPEN_STAGES of the furthest open stage the deal has reached."""
    reached = [deal.stage] + [s for change in deal.history for s in change]
    indexes = [OPEN_STAGES.index(s) for s in reached if s in OPEN_STAGES]
    return max(indexes, default=0)


def funnel(deals: Iterable[FunnelDeal]) -> list[dict]:
    """How much value reached each stage, from New down to Won.

    Open deals count toward every stage up to the furthest they have reached.
    Won deals count toward every stage. Lost deals count up to the furthest
    open stage they reached.
    """
    rows = {stage: {"stage": stage, "value_cents": 0, "count": 0} for stage in FUNNEL_STAGES}
    for deal in deals:
        if deal.stage == "won":
            reached = FUNNEL_STAGES
        else:
            reached = OPEN_STAGES[: furthest_open_stage(deal) + 1]
        for stage in reached:
            rows[stage]["value_cents"] += deal.value_cents
            rows[stage]["count"] += 1
    top = rows["new"]["value_cents"]
    for row in rows.values():
        # Half rounds up, as people expect: 82.5% shows as 83%.
        row["percent_of_new"] = (row["value_cents"] * 200 + top) // (2 * top) if top else 0
    return list(rows.values())


def follow_up_state(follow_up_date: str | None, done: bool, today: date | str) -> str | None:
    """None without a follow-up; otherwise done, overdue, coming_up or later."""
    if follow_up_date is None:
        return None
    if done:
        return "done"
    today_iso = _iso(today)
    if follow_up_date < today_iso:
        return "overdue"
    limit = (date.fromisoformat(today_iso) + timedelta(days=COMING_UP_DAYS)).isoformat()
    if follow_up_date <= limit:
        return "coming_up"
    return "later"
