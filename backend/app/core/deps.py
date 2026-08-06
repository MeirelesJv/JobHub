from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db

SINGLE_USER_ID = 1


def get_current_user(db: Session = Depends(get_db)):
    from app.models.user import User

    user = db.get(User, SINGLE_USER_ID)
    if user is None:
        user = User(id=SINGLE_USER_ID, email="local@jobhub.app", full_name="Usuário")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
