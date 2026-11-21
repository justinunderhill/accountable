"""Organizations: reads and writes."""

import sqlalchemy as sa

from .. import clock, rules
from ..db import contacts, deals, organizations
from ..errors import not_found
from . import contacts as contact_queries
from . import deals as deal_queries


def _list_query():
    contact_counts = (
        sa.select(contacts.c.organization_id, sa.func.count().label("n"))
        .group_by(contacts.c.organization_id)
        .subquery()
    )
    open_counts = (
        sa.select(deals.c.organization_id, sa.func.count().label("n"))
        .where(deals.c.stage.in_(rules.OPEN_STAGES))
        .group_by(deals.c.organization_id)
        .subquery()
    )
    return (
        sa.select(
            organizations,
            sa.func.coalesce(contact_counts.c.n, 0).label("contact_count"),
            sa.func.coalesce(open_counts.c.n, 0).label("open_deal_count"),
        )
        .select_from(
            organizations.outerjoin(contact_counts, contact_counts.c.organization_id == organizations.c.id).outerjoin(
                open_counts, open_counts.c.organization_id == organizations.c.id
            )
        )
        .order_by(sa.func.lower(organizations.c.name), organizations.c.id)
    )


def list_all(conn: sa.Connection) -> list[dict]:
    return [dict(r) for r in conn.execute(_list_query()).mappings()]


def get_row(conn: sa.Connection, org_id: int) -> dict:
    row = conn.execute(_list_query().where(organizations.c.id == org_id)).mappings().first()
    if row is None:
        raise not_found("Organization")
    return dict(row)


def create(conn: sa.Connection, data: dict) -> dict:
    stamp = clock.stamp()
    org_id = conn.execute(
        sa.insert(organizations).values(**data, created_at=stamp, updated_at=stamp)
    ).inserted_primary_key[0]
    return get_row(conn, org_id)


def update(conn: sa.Connection, org_id: int, data: dict) -> dict:
    get_row(conn, org_id)
    if data:
        conn.execute(
            sa.update(organizations).where(organizations.c.id == org_id).values(**data, updated_at=clock.stamp())
        )
    return get_row(conn, org_id)


def delete(conn: sa.Connection, org_id: int) -> None:
    get_row(conn, org_id)
    # Contacts and deals are kept, with no organization (ON DELETE SET NULL).
    conn.execute(sa.delete(organizations).where(organizations.c.id == org_id))


def impact(conn: sa.Connection, org_id: int) -> dict:
    org = get_row(conn, org_id)
    deal_count = conn.scalar(sa.select(sa.func.count()).select_from(deals).where(deals.c.organization_id == org_id))
    return {"name": org["name"], "contact_count": org["contact_count"], "deal_count": deal_count}


def detail(conn: sa.Connection, org_id: int) -> dict:
    org = get_row(conn, org_id)
    org["contacts"] = contact_queries.rows(conn, contacts.c.organization_id == org_id)
    org["deals"] = deal_queries.rows(conn, deals.c.organization_id == org_id)
    org["open_pipeline_cents"] = sum(d["value_cents"] for d in org["deals"] if rules.is_open(d["stage"]))
    org["won_cents"] = sum(d["value_cents"] for d in org["deals"] if d["stage"] == "won")
    return org


def industries(conn: sa.Connection) -> list[str]:
    query = (
        sa.select(organizations.c.industry)
        .where(organizations.c.industry.is_not(None))
        .distinct()
        .order_by(organizations.c.industry)
    )
    return list(conn.scalars(query))
