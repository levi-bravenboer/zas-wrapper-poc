from fastapi import FastAPI

from app.api.routers.system_router import router as system_router


def register_routers(app: FastAPI) -> None:
    app.include_router(system_router)
