from fastapi import APIRouter, Request, Response

from .. import schemas
from ..deps import transaction
from ..queries import organizations as q

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[schemas.OrganizationRow])
def list_organizations(request: Request):
    with transaction(request) as conn:
        return q.list_all(conn)


@router.get("/industries", response_model=list[str])
def list_industries(request: Request):
    with transaction(request) as conn:
        return q.industries(conn)


@router.post("", status_code=201, response_model=schemas.OrganizationRow)
def create_organization(body: schemas.OrganizationCreate, request: Request):
    with transaction(request) as conn:
        return q.create(conn, body.model_dump())


@router.get("/{org_id}", response_model=schemas.OrganizationDetail)
def get_organization(org_id: int, request: Request):
    with transaction(request) as conn:
        return q.detail(conn, org_id)


@router.patch("/{org_id}", response_model=schemas.OrganizationRow)
def update_organization(org_id: int, body: schemas.OrganizationPatch, request: Request):
    with transaction(request) as conn:
        return q.update(conn, org_id, body.sent())


@router.delete("/{org_id}", status_code=204)
def delete_organization(org_id: int, request: Request):
    with transaction(request) as conn:
        q.delete(conn, org_id)
    return Response(status_code=204)


@router.get("/{org_id}/delete-impact", response_model=schemas.OrganizationImpact)
def organization_delete_impact(org_id: int, request: Request):
    with transaction(request) as conn:
        return q.impact(conn, org_id)
