"""Contacts: reads, writes and the delete rule."""

import sqlalchemy as sa

from .. import clock
from ..db import activities, contacts, deals, organizations
from ..errors import ApiError, field_errors, not_found
from . import deals as deal_queries
from . import timeline


def _query():
    return sa.select(contacts, organizations.c.name.label("organization_name")).select_from(
        contacts.outerjoin(organizations, contacts.c.organization_id == organizations.c.id)
    )


def rows(conn: sa.Connection, *where) -> list[dict]:
    query = _query().where(*where).order_by(sa.func.lower(contacts.c.name), contacts.c.id)
    return [dict(r) for r in conn.execute(query).mappings()]


def get_row(conn: sa.Connection, contact_id: int) -> dict:
    row = conn.execute(_query().where(contacts.c.id == contact_id)).mappings().first()
    if row is None:
        raise not_found("Contact")
    return dict(row)


def _check_organization(conn: sa.Connection, data: dict) -> None:
    if "organization_id" in data:
        exists = conn.execute(
            sa.select(organizations.c.id).where(organizations.c.id == data["organization_id"])
        ).first()
        if exists is None:
            raise field_errors({"organization_id": "Pick an organization."})


def create(conn: sa.Connection, data: dict) -> dict:
    _check_organization(conn, data)
    stamp = clock.stamp()
    contact_id = conn.execute(
        sa.insert(contacts).values(**data, created_at=stamp, updated_at=stamp)
    ).inserted_primary_key[0]
    return get_row(conn, contact_id)


def update(conn: sa.Connection, contact_id: int, data: dict) -> dict:
    get_row(conn, contact_id)
    _check_organization(conn, data)
    if data:
        conn.execute(sa.update(contacts).where(contacts.c.id == contact_id).values(**data, updated_at=clock.stamp()))
    return get_row(conn, contact_id)


def _blocking_deals(conn: sa.Connection, contact_id: int) -> list[dict]:
    query = sa.select(deals.c.id, deals.c.name).where(deals.c.contact_id == contact_id).order_by(deals.c.name)
    return [dict(r) for r in conn.execute(query).mappings()]


def impact(conn: sa.Connection, contact_id: int) -> dict:
    contact = get_row(conn, contact_id)
    activity_count = conn.scalar(
        sa.select(sa.func.count()).select_from(activities).where(activities.c.contact_id == contact_id)
    )
    return {"name": contact["name"], "deals": _blocking_deals(conn, contact_id), "activity_count": activity_count}


def delete(conn: sa.Connection, contact_id: int) -> None:
    contact = get_row(conn, contact_id)
    blocking = _blocking_deals(conn, contact_id)
    if blocking:
        count = len(blocking)
        name = contact["name"]
        raise ApiError(
            409,
            f"{name} is the main contact on {count} deal{'s' if count != 1 else ''}. "
            f"Give each deal another contact before deleting {name}.",
            deals=blocking,
        )
    # Their activities go too (ON DELETE CASCADE).
    conn.execute(sa.delete(contacts).where(contacts.c.id == contact_id))


def detail(conn: sa.Connection, contact_id: int) -> dict:
    contact = get_row(conn, contact_id)
    org_id = contact["organization_id"]
    contact["organization"] = {"id": org_id, "name": contact["organization_name"]} if org_id else None
    contact["deals"] = deal_queries.rows(conn, deals.c.contact_id == contact_id)
    contact["timeline"] = timeline.for_contact(conn, contact_id)
    return contact
