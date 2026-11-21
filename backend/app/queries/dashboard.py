"""Every dashboard figure, from the same rules as the rest of the app."""

from datetime import date, timedelta

import sqlalchemy as sa

from .. import clock, rules
from ..db import activities, contacts, deals, stage_changes
from . import timeline


def _month_starts(today: date, count: int = 12) -> list[date]:
    """The first day of each of the last `count` calendar months, oldest first, this month last."""
    starts = []
    year, month = today.year, today.month
    for _ in range(count):
        starts.append(date(year, month, 1))
        year, month = (year, month - 1) if month > 1 else (year - 1, 12)
    return starts[::-1]


def _follow_ups(conn: sa.Connection, today: date) -> dict:
    limit = (today + timedelta(days=rules.COMING_UP_DAYS)).isoformat()
    query = (
        sa.select(
            activities.c.id,
            activities.c.type,
            activities.c.description,
            activities.c.occurred_at,
            activities.c.follow_up_date,
            activities.c.contact_id,
            activities.c.deal_id,
            contacts.c.name.label("contact_name"),
            deals.c.name.label("deal_name"),
        )
        .select_from(
            activities.outerjoin(contacts, activities.c.contact_id == contacts.c.id)
            .outerjoin(deals, activities.c.deal_id == deals.c.id)
        )
        .where(
            activities.c.follow_up_date.is_not(None),
            activities.c.done.is_(False),
            activities.c.follow_up_date <= limit,
        )
        .order_by(activities.c.follow_up_date, activities.c.id)
    )
    groups: dict[str, list[dict]] = {"overdue": [], "coming_up": []}
    for row in conn.execute(query).mappings():
        state = rules.follow_up_state(row["follow_up_date"], False, today)
        groups[state].append(
            {
                "id": row["id"],
                "type": row["type"],
                "description": row["description"],
                "occurred_at": row["occurred_at"],
                "follow_up_date": row["follow_up_date"],
                "contact": {"id": row["contact_id"], "name": row["contact_name"]} if row["contact_id"] else None,
                "deal": {"id": row["deal_id"], "name": row["deal_name"]} if row["deal_id"] else None,
            }
        )
    return groups


def dashboard(conn: sa.Connection) -> dict:
    today = clock.today()
    today_iso = today.isoformat()
    deal_rows = (
        conn.execute(sa.select(deals.c.id, deals.c.stage, deals.c.value_cents, deals.c.probability, deals.c.close_date))
        .mappings()
        .all()
    )

    # Open pipeline
    open_by_stage = {s: {"stage": s, "value_cents": 0, "count": 0} for s in rules.OPEN_STAGES}
    expected = 0
    for d in deal_rows:
        if rules.is_open(d["stage"]):
            open_by_stage[d["stage"]]["value_cents"] += d["value_cents"]
            open_by_stage[d["stage"]]["count"] += 1
            expected += rules.expected_cents(d["value_cents"], d["probability"])
    open_rows = list(open_by_stage.values())

    # Won over the last 12 calendar months, this one included
    starts = _month_starts(today)
    months = {s.isoformat()[:7]: {"month": s.isoformat()[:7], "revenue_cents": 0, "deals": 0} for s in starts}
    for d in deal_rows:
        if d["stage"] == "won" and d["close_date"][:7] in months:
            months[d["close_date"][:7]]["revenue_cents"] += d["value_cents"]
            months[d["close_date"][:7]]["deals"] += 1
    month_rows = list(months.values())
    this_month = month_rows[-1]

    # Funnel, from stage history
    history: dict[int, list[tuple[str, str]]] = {}
    for row in conn.execute(sa.select(stage_changes.c.deal_id, stage_changes.c.from_stage, stage_changes.c.to_stage)):
        history.setdefault(row.deal_id, []).append((row.from_stage, row.to_stage))
    funnel = rules.funnel(
        rules.FunnelDeal(d["stage"], d["value_cents"], history.get(d["id"], [])) for d in deal_rows
    )

    follow_ups = _follow_ups(conn, today)
    return {
        "today": today_iso,
        "figures": {
            "open_pipeline_cents": sum(r["value_cents"] for r in open_rows),
            "open_count": sum(r["count"] for r in open_rows),
            "expected_cents": expected,
            "won_12m_cents": sum(m["revenue_cents"] for m in month_rows),
            "won_12m_count": sum(m["deals"] for m in month_rows),
            "won_this_month_cents": this_month["revenue_cents"],
            "won_this_month_count": this_month["deals"],
            "overdue_count": len(follow_ups["overdue"]),
            "coming_up_count": len(follow_ups["coming_up"]),
        },
        "months": month_rows,
        "funnel": funnel,
        "open_by_stage": open_rows,
        "follow_ups": follow_ups,
        "recent": timeline.recent(conn, 10),
    }
