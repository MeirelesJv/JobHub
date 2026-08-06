from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator

LEVELS = ("junior", "pleno", "senior")


class DesiredRoleCreate(BaseModel):
    role_name: str
    level: Optional[str] = None
    is_primary: bool = False
    order: Optional[int] = None

    @field_validator("role_name")
    @classmethod
    def role_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome do cargo não pode ser vazio")
        return v

    @field_validator("level")
    @classmethod
    def level_valid(cls, v: str | None) -> str | None:
        if v and v not in LEVELS:
            raise ValueError(f"Nível inválido: {v}")
        return v or None


class DesiredRoleUpdate(BaseModel):
    role_name: Optional[str] = None
    level: Optional[str] = None
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

    @field_validator("level")
    @classmethod
    def level_valid(cls, v: str | None) -> str | None:
        if v and v not in LEVELS:
            raise ValueError(f"Nível inválido: {v}")
        return v or None


class DesiredRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role_name: str
    level: Optional[str] = None
    is_primary: bool
    order: int
