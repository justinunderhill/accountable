from fastapi import APIRouter, Request

from .. import schemas
from ..deps import transaction
from ..queries import deals as q

router = APIRouter(tags=["pipeline"])


@router.get("/pipeline", response_model=schemas.Pipeline)
def get_pipeline(request: Request):
    with transaction(request) as conn:
        return q.pipeline(conn)
