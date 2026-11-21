"""Today and now, in the computer's local time.

Everything that needs the date asks here, so tests can fix it with `freeze`.
"""

from datetime import date, datetime

_frozen: datetime | None = None


def now() -> datetime:
    if _frozen is not None:
        return _frozen
    return datetime.now().replace(microsecond=0)


def today() -> date:
    return now().date()


def freeze(at: datetime | None) -> None:
    """Fix the clock at `at`, or pass None to let it run again."""
    global _frozen
    _frozen = at.replace(microsecond=0) if at else None


def stamp(at: datetime | None = None) -> str:
    """A datetime as stored in the database: ISO 8601, local time, to the second."""
    return (at or now()).isoformat(timespec="seconds")
