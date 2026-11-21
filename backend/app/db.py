"""The database: SQLAlchemy Core tables, indexes and the engine.

Dates are stored as YYYY-MM-DD strings and times as ISO 8601 strings in local
time, so they sort and compare correctly as text.
"""

from pathlib import Path

import sqlalchemy as sa
from sqlalchemy import event

metadata = sa.MetaData()

organizations = sa.Table(
    "organizations",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("name", sa.String(200), nullable=False),
    sa.Column("website", sa.String),
    sa.Column("industry", sa.String),
    sa.Column("notes", sa.Text),
    sa.Column("created_at", sa.String(19), nullable=False),
    sa.Column("updated_at", sa.String(19), nullable=False),
)

contacts = sa.Table(
    "contacts",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("name", sa.String(200), nullable=False),
    sa.Column("email", sa.String),
    sa.Column("phone", sa.String),
    sa.Column("job_title", sa.String),
    sa.Column(
        "organization_id",
        sa.Integer,
        sa.ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    ),
    sa.Column("status", sa.String(20), nullable=False, server_default="lead"),
    sa.Column("created_at", sa.String(19), nullable=False),
    sa.Column("updated_at", sa.String(19), nullable=False),
)

deals = sa.Table(
    "deals",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("name", sa.String(200), nullable=False),
    sa.Column(
        "organization_id",
        sa.Integer,
        sa.ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    ),
    sa.Column(
        "contact_id",
        sa.Integer,
        sa.ForeignKey("contacts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    ),
    sa.Column("stage", sa.String(20), nullable=False),
    sa.Column("value_cents", sa.Integer, nullable=False),
    sa.Column("probability", sa.Integer, nullable=False),
    sa.Column("close_date", sa.String(10), nullable=False),
    sa.Column("position", sa.Integer, nullable=False, server_default="0"),
    sa.Column("created_at", sa.String(19), nullable=False),
    sa.Column("updated_at", sa.String(19), nullable=False),
    sa.CheckConstraint(sa.column("value_cents") >= 0, name="value_not_negative"),
    sa.CheckConstraint(sa.column("probability").between(0, 100), name="probability_range"),
    sa.Index("ix_deals_stage_position", "stage", "position"),
)

activities = sa.Table(
    "activities",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("type", sa.String(10), nullable=False),
    sa.Column("description", sa.Text, nullable=False),
    sa.Column("occurred_at", sa.String(19), nullable=False),
    sa.Column("follow_up_date", sa.String(10), nullable=True),
    sa.Column("done", sa.Boolean, nullable=False, server_default=sa.false()),
    sa.Column(
        "contact_id",
        sa.Integer,
        sa.ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    ),
    sa.Column(
        "deal_id",
        sa.Integer,
        sa.ForeignKey("deals.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    ),
    sa.Column("created_at", sa.String(19), nullable=False),
    sa.Column("updated_at", sa.String(19), nullable=False),
    # Exactly one of contact_id and deal_id is set.
    sa.CheckConstraint(
        sa.or_(
            sa.and_(sa.column("contact_id").is_not(None), sa.column("deal_id").is_(None)),
            sa.and_(sa.column("contact_id").is_(None), sa.column("deal_id").is_not(None)),
        ),
        name="exactly_one_link",
    ),
    sa.Index("ix_activities_follow_up", "follow_up_date", "done"),
)

stage_changes = sa.Table(
    "stage_changes",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column(
        "deal_id",
        sa.Integer,
        sa.ForeignKey("deals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    sa.Column("from_stage", sa.String(20), nullable=False),
    sa.Column("to_stage", sa.String(20), nullable=False),
    sa.Column("changed_at", sa.String(19), nullable=False),
)


def _foreign_keys_on(dbapi_connection, _record) -> None:
    # SQLite ignores foreign keys unless every connection asks for them.
    # This is the only SQL string in the project.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


def make_engine(path: Path) -> sa.Engine:
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = sa.create_engine(
        f"sqlite:///{path.as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 15},
    )
    event.listen(engine, "connect", _foreign_keys_on)
    return engine


def create_tables(engine: sa.Engine) -> None:
    metadata.create_all(engine)
