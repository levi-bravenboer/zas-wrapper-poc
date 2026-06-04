from fastapi import APIRouter

from app.api.routers.mobile.auth.me_router import router as me_router
from app.api.routers.mobile.auth.password_router import router as password_router

auth_router = APIRouter()
auth_router.include_router(password_router)
auth_router.include_router(me_router)

__all__ = ["auth_router"]
