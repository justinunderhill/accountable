"""Deals: reads, writes, stage changes and card order."""

import sqlalchemy as sa

from .. import clock, rules
from ..db import activities, contacts, deals, organizations, stage_changes
from ..errors import field_errors, not_found

_columns = [
    deals,
    organizations.c.name.label("organization_name"),
    contacts.c.name.label("contact_name"),
]
_from = deals.outerjoin(organizations, deals.c.organization_id == organizations.c.id).join(
    contacts, deals.c.contact_id == contacts.c.id
)


def to_row(mapping, today: str) -> dict:
    row = dict(mapping)
    row["expected_cents"] = rules.expected_cents(row["value_cents"], row["probability"])
    row["late"] = rules.is_late(row["stage"], row["close_date"], today)
    row["probability_by_hand"] = row["probability"] != rules.DEFAULT_PROBABILITY[row["stage"]]
    return row


def rows(conn: sa.Connection, *where, order_by=None) -> list[dict]:
    today = clock.today().isoformat()
    query = sa.select(*_columns).select_from(_from).where(*where)
    query = query.order_by(*(order_by if order_by is not None else [deals.c.close_date, deals.c.id]))
    return [to_row(r, today) for r in conn.execute(query).mappings()]


def get_row(conn: sa.Connection, deal_id: int) -> dict:
    found = rows(conn, deals.c.id == deal_id)
    if not found:
        raise not_found("Deal")
    return found[0]


def _check_links(conn: sa.Connection, data: dict) -> None:
    errors = {}
    if "contact_id" in data:
        if conn.execute(sa.select(contacts.c.id).where(contacts.c.id == data["contact_id"])).first() is None:
            errors["contact_id"] = "Pick a main contact."
    if data.get("organization_id") is not None:
        exists = conn.execute(
            sa.select(organizations.c.id).where(organizations.c.id == data["organization_id"])
        ).first()
        if exists is None:
            errors["organization_id"] = "Pick an organization, or leave it blank."
    if errors:
        raise field_errors(errors)


def column_ids(conn: sa.Connection, stage: str) -> list[int]:
    query = sa.select(deals.c.id).where(deals.c.stage == stage).order_by(deals.c.position, deals.c.id)
    return list(conn.scalars(query))


def _renumber(conn: sa.Connection, ids: list[int]) -> None:
    current = dict(conn.execute(sa.select(deals.c.id, deals.c.position).where(deals.c.id.in_(ids))).all())
    changed = [{"b_id": deal_id, "b_pos": pos} for pos, deal_id in enumerate(ids) if current.get(deal_id) != pos]
    if changed:
        conn.execute(
            sa.update(deals).where(deals.c.id == sa.bindparam("b_id")).values(position=sa.bindparam("b_pos")),
            changed,
        )


def _record_stage_change(conn: sa.Connection, deal_id: int, from_stage: str, to_stage: str, at: str) -> None:
    conn.execute(
        sa.insert(stage_changes).values(deal_id=deal_id, from_stage=from_stage, to_stage=to_stage, changed_at=at)
    )


def create(conn: sa.Connection, data: dict) -> dict:
    _check_links(conn, data)
    stamp = clock.stamp()
    stage = data.get("stage", "new")
    probability = data.get("probability")
    # A new deal goes to the top of its column.
    conn.execute(sa.update(deals).where(deals.c.stage == stage).values(position=deals.c.position + 1))
    deal_id = conn.execute(
        sa.insert(deals).values(
            name=data["name"],
            contact_id=data["contact_id"],
            organization_id=data.get("organization_id"),
            stage=stage,
            value_cents=data["value_cents"],
            probability=rules.DEFAULT_PROBABILITY[stage] if probability is None else probability,
            close_date=data["close_date"],
            position=0,
            created_at=stamp,
            updated_at=stamp,
        )
    ).inserted_primary_key[0]
    return get_row(conn, deal_id)


def _move(conn: sa.Connection, deal: dict, to_stage: str, index: int, given: dict) -> None:
    """Move a card to `index` in `to_stage`, applying the stage rules if the stage changes."""
    stamp = clock.stamp()
    old_stage = deal["stage"]
    columns = {old_stage: column_ids(conn, old_stage)}
    if to_stage != old_stage:
        columns[to_stage] = column_ids(conn, to_stage)
    new_columns = rules.reorder(columns, deal["id"], to_stage, index)
    updates = rules.stage_change(
        old_stage, to_stage, clock.today(), given.get("probability"), given.get("close_date")
    )
    if updates:
        conn.execute(sa.update(deals).where(deals.c.id == deal["id"]).values(**updates, updated_at=stamp))
        _record_stage_change(conn, deal["id"], old_stage, to_stage, stamp)
    for ids in new_columns.values():
        _renumber(conn, ids)


def update(conn: sa.Connection, deal_id: int, data: dict) -> dict:
    deal = get_row(conn, deal_id)
    _check_links(conn, data)
    data = dict(data)
    new_stage = data.pop("stage", deal["stage"])
    if new_stage != deal["stage"]:
        # A stage change by form puts the card at the top of its new column.
        _move(conn, deal, new_stage, 0, data)
        data.pop("probability", None)
        data.pop("close_date", None)
    if data:
        conn.execute(sa.update(deals).where(deals.c.id == deal_id).values(**data, updated_at=clock.stamp()))
    return get_row(conn, deal_id)


def move(conn: sa.Connection, deal_id: int, stage: str, index: int) -> dict:
    deal = get_row(conn, deal_id)
    _move(conn, deal, stage, index, {})
    return get_row(conn, deal_id)


def delete(conn: sa.Connection, deal_id: int) -> None:
    deal = get_row(conn, deal_id)
    # Activities and stage changes go with the deal (ON DELETE CASCADE).
    conn.execute(sa.delete(deals).where(deals.c.id == deal_id))
    _renumber(conn, column_ids(conn, deal["stage"]))


def impact(conn: sa.Connection, deal_id: int) -> dict:
    deal = get_row(conn, deal_id)
    count = sa.select(sa.func.count())
    return {
        "name": deal["name"],
        "activity_count": conn.scalar(count.select_from(activities).where(activities.c.deal_id == deal_id)),
        "stage_change_count": conn.scalar(
            count.select_from(stage_changes).where(stage_changes.c.deal_id == deal_id)
        ),
    }


def detail(conn: sa.Connection, deal_id: int) -> dict:
    from . import timeline

    deal = get_row(conn, deal_id)
    deal["timeline"] = timeline.for_deal(conn, deal_id)
    return deal


def pipeline(conn: sa.Connection) -> dict:
    """Every deal grouped by stage in card order, with column and board totals."""
    all_rows = rows(conn, order_by=[deals.c.position, deals.c.id])
    columns = []
    for stage in rules.STAGES:
        cards = [d for d in all_rows if d["stage"] == stage]
        columns.append(
            {
                "stage": stage,
                "count": len(cards),
                "total_cents": sum(d["value_cents"] for d in cards),
                "expected_cents": sum(d["expected_cents"] for d in cards),
                "deals": cards,
            }
        )
    open_columns = [c for c in columns if rules.is_open(c["stage"])]
    return {
        "columns": columns,
        "totals": {
            "open_cents": sum(c["total_cents"] for c in open_columns),
            "expected_cents": sum(c["expected_cents"] for c in open_columns),
            "open_count": sum(c["count"] for c in open_columns),
        },
    }

