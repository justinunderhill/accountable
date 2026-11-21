from fastapi import APIRouter, Request, Response

from .. import schemas
from ..deps import transaction
from ..queries import contacts as q

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[schemas.ContactRow])
def list_contacts(request: Request):
    with transaction(request) as conn:
        return q.rows(conn)


@router.post("", status_code=201, response_model=schemas.ContactRow)
def create_contact(body: schemas.ContactCreate, request: Request):
    with transaction(request) as conn:
        return q.create(conn, body.model_dump())


@router.get("/{contact_id}", response_model=schemas.ContactDetail)
def get_contact(contact_id: int, request: Request):
    with transaction(request) as conn:
        return q.detail(conn, contact_id)


@router.patch("/{contact_id}", response_model=schemas.ContactRow)
def update_contact(contact_id: int, body: schemas.ContactPatch, request: Request):
    with transaction(request) as conn:
        return q.update(conn, contact_id, body.sent())


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, request: Request):
    with transaction(request) as conn:
        q.delete(conn, contact_id)
    return Response(status_code=204)


@router.get("/{contact_id}/delete-impact", response_model=schemas.ContactImpact)
def contact_delete_impact(contact_id: int, request: Request):
    with transaction(request) as conn:
        return q.impact(conn, contact_id)
