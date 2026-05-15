from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ProviderDescriptor(BaseModel):
    key: str
    label: str
    kind: Literal["password", "oidc"]
