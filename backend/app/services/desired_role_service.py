from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.desired_role import UserDesiredRole
from app.schemas.desired_role import DesiredRoleCreate, DesiredRoleUpdate

MAX_ROLES = 5


def _sync_primary_to_user(db: Session, user_id: int, role_name: str | None) -> None:
    from app.models.user import User
    user = db.get(User, user_id)
    if user:
        user.desired_role = role_name
        db.commit()


def get_roles(db: Session, user_id: int) -> list[UserDesiredRole]:
    return (
        db.query(UserDesiredRole)
        .filter_by(user_id=user_id)
        .order_by(UserDesiredRole.order)
        .all()
    )


def add_role(db: Session, user_id: int, data: DesiredRoleCreate) -> UserDesiredRole:
    count = db.query(UserDesiredRole).filter_by(user_id=user_id).count()
    if count >= MAX_ROLES:
        raise HTTPException(status_code=422, detail=f"Máximo de {MAX_ROLES} cargos atingido")

    is_first = count == 0
    make_primary = data.is_primary or is_first

    if make_primary:
        db.query(UserDesiredRole).filter_by(user_id=user_id, is_primary=True).update({"is_primary": False})

    role = UserDesiredRole(
        user_id=user_id,
        role_name=data.role_name,
        is_primary=make_primary,
        order=data.order if data.order is not None else count,
    )
    db.add(role)
    db.commit()
    db.refresh(role)

    if role.is_primary:
        _sync_primary_to_user(db, user_id, role.role_name)

    return role


def update_role(db: Session, user_id: int, role_id: int, data: DesiredRoleUpdate) -> UserDesiredRole:
    role = db.query(UserDesiredRole).filter_by(id=role_id, user_id=user_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Cargo não encontrado")

    if data.is_primary and not role.is_primary:
        db.query(UserDesiredRole).filter_by(user_id=user_id, is_primary=True).update({"is_primary": False})

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(role, field, value)

    db.commit()
    db.refresh(role)

    if role.is_primary:
        _sync_primary_to_user(db, user_id, role.role_name)

    return role


def delete_role(db: Session, user_id: int, role_id: int) -> None:
    role = db.query(UserDesiredRole).filter_by(id=role_id, user_id=user_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Cargo não encontrado")

    was_primary = role.is_primary
    db.delete(role)
    db.flush()

    if was_primary:
        next_role = (
            db.query(UserDesiredRole)
            .filter_by(user_id=user_id)
            .order_by(UserDesiredRole.order)
            .first()
        )
        if next_role:
            next_role.is_primary = True
            db.commit()
            _sync_primary_to_user(db, user_id, next_role.role_name)
        else:
            db.commit()
            _sync_primary_to_user(db, user_id, None)
    else:
        db.commit()


def set_primary(db: Session, user_id: int, role_id: int) -> UserDesiredRole:
    role = db.query(UserDesiredRole).filter_by(id=role_id, user_id=user_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Cargo não encontrado")

    db.query(UserDesiredRole).filter_by(user_id=user_id, is_primary=True).update({"is_primary": False})
    role.is_primary = True
    db.commit()
    db.refresh(role)
    _sync_primary_to_user(db, user_id, role.role_name)
    return role


def reorder_roles(db: Session, user_id: int, ordered_ids: list[int]) -> list[UserDesiredRole]:
    for i, role_id in enumerate(ordered_ids):
        db.query(UserDesiredRole).filter_by(id=role_id, user_id=user_id).update({"order": i})
    db.commit()
    return get_roles(db, user_id)
