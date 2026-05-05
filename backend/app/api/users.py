from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.desired_role import DesiredRoleCreate, DesiredRoleResponse, DesiredRoleUpdate
from app.schemas.user import UserProfileUpdate, UserResponse
from app.services import desired_role_service

router = APIRouter()


@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


# ─── desired roles ────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[DesiredRoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return desired_role_service.get_roles(db, current_user.id)


@router.post("/roles", response_model=DesiredRoleResponse, status_code=201)
def create_role(
    data: DesiredRoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return desired_role_service.add_role(db, current_user.id, data)


@router.put("/roles/{role_id}", response_model=DesiredRoleResponse)
def update_role(
    role_id: int,
    data: DesiredRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return desired_role_service.update_role(db, current_user.id, role_id, data)


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    desired_role_service.delete_role(db, current_user.id, role_id)


@router.patch("/roles/{role_id}/primary", response_model=DesiredRoleResponse)
def set_primary_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return desired_role_service.set_primary(db, current_user.id, role_id)
