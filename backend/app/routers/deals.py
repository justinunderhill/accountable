from fastapi import APIRouter, Request, Response

from .. import schemas
from ..deps import transaction
from ..queries import deals as q

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("", response_model=list[schemas.DealRow])
def list_deals(request: Request):
    with transaction(request) as conn:
        return q.rows(conn)


@router.post("", status_code=201, response_model=schemas.DealRow)
def create_deal(body: schemas.DealCreate, request: Request):
    with transaction(request) as conn:
        return q.create(conn, body.model_dump())


@router.get("/{deal_id}", response_model=schemas.DealDetail)
def get_deal(deal_id: int, request: Request):
    with transaction(request) as conn:
        return q.detail(conn, deal_id)


@router.patch("/{deal_id}", response_model=schemas.DealRow)
def update_deal(deal_id: int, body: schemas.DealPatch, request: Request):
    with transaction(request) as conn:
        return q.update(conn, deal_id, body.sent())


@router.post("/{deal_id}/move", response_model=schemas.DealRow)
def move_deal(deal_id: int, body: schemas.DealMove, request: Request):
    with transaction(request) as conn:
        return q.move(conn, deal_id, body.stage, body.index)


@router.delete("/{deal_id}", status_code=204)
def delete_deal(deal_id: int, request: Request):
    with transaction(request) as conn:
        q.delete(conn, deal_id)
    return Response(status_code=204)


@router.get("/{deal_id}/delete-impact", response_model=schemas.DealImpact)
def deal_delete_impact(deal_id: int, request: Request):
    with transaction(request) as conn:
        return q.impact(conn, deal_id)
