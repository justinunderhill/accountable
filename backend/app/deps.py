"""One transaction per request: every write for a user action commits together or not at all."""

from collections.abc import Iterator
from contextlib import contextmanager

import sqlalchemy as sa
from fastapi import Request


@contextmanager
def transaction(request: Request) -> Iterator[sa.Connection]:
    with request.app.state.engine.begin() as conn:
        yield conn
