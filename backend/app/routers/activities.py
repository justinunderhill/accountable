from fastapi import APIRouter, Request, Response

from .. import schemas
from ..deps import transaction
from ..queries import activities as q

router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("", status_code=201, response_model=schemas.Activity)
def create_activity(body: schemas.ActivityCreate, request: Request):
    with transaction(request) as conn:
        return q.create(conn, body.model_dump())


@router.get("/{activity_id}", response_model=schemas.Activity)
def get_activity(activity_id: int, request: Request):
    with transaction(request) as conn:
        return q.get(conn, activity_id)


@router.patch("/{activity_id}", response_model=schemas.Activity)
def update_activity(activity_id: int, body: schemas.ActivityPatch, request: Request):
    with transaction(request) as conn:
        return q.update(conn, activity_id, body.sent())


@router.delete("/{activity_id}", status_code=204)
def delete_activity(activity_id: int, request: Request):
    with transaction(request) as conn:
        q.delete(conn, activity_id)
    return Response(status_code=204)
