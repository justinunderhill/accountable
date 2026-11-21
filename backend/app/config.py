"""Settings read from the environment.

Read on each call, so tests can point the app at their own database.
"""

import os
from pathlib import Path

DEFAULT_DB_PATH = "data/accountable.db"


def db_path() -> Path:
    return Path(os.environ.get("ACCOUNTABLE_DB_PATH", DEFAULT_DB_PATH))


def api_port() -> int:
    return int(os.environ.get("ACCOUNTABLE_API_PORT", "8000"))
