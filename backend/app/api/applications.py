from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.application import ApplicationStatus
from app.models.job import JobPlatform
from app.models.user import User
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStats,
    ApplicationUpdate,
    KanbanResponse,
    StatusUpdate,
)
from app.services import application_service

router = APIRouter()


@router.post("", response_model=ApplicationResponse, status_code=201)
def create_application(
    data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return application_service.create_application(db, current_user.id, data)


@router.get("/kanban", response_model=KanbanResponse)
def get_kanban(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return application_service.get_kanban(db, current_user.id)


@router.get("/stats", response_model=ApplicationStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return application_service.get_stats(db, current_user.id)


@router.get("", response_model=list[ApplicationResponse])
def list_applications(
    status: ApplicationStatus | None = None,
    platform: JobPlatform | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return application_service.get_applications(
        db, current_user.id, status=status, platform=platform
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return application_service.get_application(db, current_user.id, application_id)


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
def update_status(
    application_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return application_service.update_status(db, current_user.id, application_id, body.status)


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: int,
    body: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return application_service.update_application(
        db, current_user.id, application_id, status=body.status, notes=body.notes
    )


@router.delete("/{application_id}", status_code=204)
def delete_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application_service.delete_application(db, current_user.id, application_id)
