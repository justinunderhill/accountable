"""Activities: notes, calls and emails, with optional follow-ups."""

import sqlalchemy as sa

from .. import clock
from ..db import activities, contacts, deals
from ..errors import field_errors, not_found


def get(conn: sa.Connection, activity_id: int) -> dict:
    row = conn.execute(sa.select(activities).where(activities.c.id == activity_id)).mappings().first()
    if row is None:
        raise not_found("Activity")
    return dict(row)


def create(conn: sa.Connection, data: dict) -> dict:
    contact_id, deal_id = data.get("contact_id"), data.get("deal_id")
    if contact_id is None and deal_id is None:
        raise field_errors({"contact_id": "Link the activity to a contact or a deal."})
    if contact_id is not None and deal_id is not None:
        raise field_errors({"contact_id": "Link the activity to a contact or a deal, not both."})
    if contact_id is not None and conn.execute(sa.select(contacts.c.id).where(contacts.c.id == contact_id)).first() is None:
        raise field_errors({"contact_id": "That contact no longer exists."})
    if deal_id is not None and conn.execute(sa.select(deals.c.id).where(deals.c.id == deal_id)).first() is None:
        raise field_errors({"deal_id": "That deal no longer exists."})
    stamp = clock.stamp()
    activity_id = conn.execute(
        sa.insert(activities).values(**data, created_at=stamp, updated_at=stamp)
    ).inserted_primary_key[0]
    return get(conn, activity_id)


def update(conn: sa.Connection, activity_id: int, data: dict) -> dict:
    get(conn, activity_id)
    if data:
        conn.execute(
            sa.update(activities).where(activities.c.id == activity_id).values(**data, updated_at=clock.stamp())
        )
    return get(conn, activity_id)


def delete(conn: sa.Connection, activity_id: int) -> None:
    get(conn, activity_id)
    conn.execute(sa.delete(activities).where(activities.c.id == activity_id))
