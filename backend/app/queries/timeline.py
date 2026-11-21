"""Timeline entries: activities and stage changes in one shape, newest first."""

import sqlalchemy as sa

from ..db import activities, contacts, deals, organizations, stage_changes


def _activity_query():
    return (
        sa.select(
            activities,
            contacts.c.name.label("contact_name"),
            deals.c.name.label("deal_name"),
        )
        .select_from(
            activities.outerjoin(contacts, activities.c.contact_id == contacts.c.id).outerjoin(
                deals, activities.c.deal_id == deals.c.id
            )
        )
    )


def _stage_change_query():
    return sa.select(
        stage_changes,
        deals.c.name.label("deal_name"),
    ).select_from(stage_changes.join(deals, stage_changes.c.deal_id == deals.c.id))


def _activity_entry(row) -> dict:
    return {
        "kind": "activity",
        "id": row["id"],
        "at": row["occurred_at"],
        "type": row["type"],
        "description": row["description"],
        "follow_up_date": row["follow_up_date"],
        "done": row["done"],
        "contact_id": row["contact_id"],
        "deal_id": row["deal_id"],
        "contact": {"id": row["contact_id"], "name": row["contact_name"]} if row["contact_id"] else None,
        "deal": {"id": row["deal_id"], "name": row["deal_name"]} if row["deal_id"] else None,
    }


def _stage_entry(row) -> dict:
    return {
        "kind": "stage_change",
        "id": row["id"],
        "at": row["changed_at"],
        "deal_id": row["deal_id"],
        "from_stage": row["from_stage"],
        "to_stage": row["to_stage"],
        "deal": {"id": row["deal_id"], "name": row["deal_name"]},
    }


def _newest_first(entries: list[dict]) -> list[dict]:
    return sorted(entries, key=lambda e: (e["at"], e["id"]), reverse=True)


def for_deal(conn: sa.Connection, deal_id: int) -> list[dict]:
    entries = [
        _activity_entry(r)
        for r in conn.execute(_activity_query().where(activities.c.deal_id == deal_id)).mappings()
    ]
    entries += [
        _stage_entry(r)
        for r in conn.execute(_stage_change_query().where(stage_changes.c.deal_id == deal_id)).mappings()
    ]
    return _newest_first(entries)


def for_contact(conn: sa.Connection, contact_id: int) -> list[dict]:
    """The contact's own activities, plus the activities and stage changes of the
    deals where they are the main contact, each labelled with its deal."""
    deal_ids = sa.select(deals.c.id).where(deals.c.contact_id == contact_id).scalar_subquery()
    activity_rows = conn.execute(
        _activity_query().where(
            sa.or_(activities.c.contact_id == contact_id, activities.c.deal_id.in_(deal_ids))
        )
    ).mappings()
    entries = [_activity_entry(r) for r in activity_rows]
    entries += [
        _stage_entry(r)
        for r in conn.execute(_stage_change_query().where(stage_changes.c.deal_id.in_(deal_ids))).mappings()
    ]
    return _newest_first(entries)


def recent(conn: sa.Connection, limit: int = 10) -> list[dict]:
    """The latest entries across every contact and deal, with the organization for context."""
    activity_rows = conn.execute(
        _activity_query()
        .add_columns(
            sa.func.coalesce(contacts.c.organization_id, deals.c.organization_id).label("org_id"),
        )
        .order_by(activities.c.occurred_at.desc(), activities.c.id.desc())
        .limit(limit)
    ).mappings()
    entries = []
    for r in activity_rows:
        entry = _activity_entry(r)
        entry["org_id"] = r["org_id"]
        entries.append(entry)
    stage_rows = conn.execute(
        _stage_change_query()
        .add_columns(deals.c.organization_id.label("org_id"))
        .order_by(stage_changes.c.changed_at.desc(), stage_changes.c.id.desc())
        .limit(limit)
    ).mappings()
    for r in stage_rows:
        entry = _stage_entry(r)
        entry["org_id"] = r["org_id"]
        entries.append(entry)
    entries = _newest_first(entries)[:limit]

    org_ids = {e["org_id"] for e in entries if e["org_id"]}
    names = dict(
        conn.execute(sa.select(organizations.c.id, organizations.c.name).where(organizations.c.id.in_(org_ids))).all()
    )
    for entry in entries:
        org_id = entry.pop("org_id")
        entry["organization"] = {"id": org_id, "name": names[org_id]} if org_id in names else None
    return entries
