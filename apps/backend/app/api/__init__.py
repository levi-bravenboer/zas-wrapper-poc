from fastapi import FastAPI

from app.api.routers.auth_router import router as auth_router
from app.api.routers.system_router import router as system_router


def register_routers(app: FastAPI) -> None:
    app.include_router(system_router)
    app.include_router(auth_router, prefix="/auth", tags=["auth"])
