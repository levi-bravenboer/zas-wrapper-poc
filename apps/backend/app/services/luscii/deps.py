from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.services.luscii.luscii_service import LusciiService


def get_luscii_service() -> LusciiService:
    return LusciiService()


LusciiServiceDep = Annotated[LusciiService, Depends(get_luscii_service)]
