from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator


class DesiredRoleCreate(BaseModel):
    role_name: str
    is_primary: bool = False
    order: Optional[int] = None

    @field_validator("role_name")
    @classmethod
    def role_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome do cargo não pode ser vazio")
        return v


class DesiredRoleUpdate(BaseModel):
    role_name: Optional[str] = None
    is_primary: Optional[bool] = None
    order: Optional[int] = None

    @field_validator("role_name")
    @classmethod
    def role_name_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Nome do cargo não pode ser vazio")
        return v


class DesiredRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role_name: str
    is_primary: bool
    order: int
