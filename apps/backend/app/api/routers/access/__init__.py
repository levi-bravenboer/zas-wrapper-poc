from fastapi import APIRouter

from app.api.routers.access.access_grant_router import router as access_grant_router
from app.api.routers.access.external_router import router as external_router
from app.api.routers.access.scoping_router import router as scoping_router

router = APIRouter()
router.include_router(access_grant_router)
router.include_router(scoping_router)
router.include_router(external_router)

__all__ = ["router"]
