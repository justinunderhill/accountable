from fastapi import APIRouter, Request

from .. import schemas
from ..deps import transaction
from ..queries import dashboard as q

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=schemas.Dashboard)
def get_dashboard(request: Request):
    with transaction(request) as conn:
        return q.dashboard(conn)
