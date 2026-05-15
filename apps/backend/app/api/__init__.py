from fastapi import FastAPI

from app.api.routers.auth import router as auth_router
from app.api.routers.organisation import router as organisation_router
from app.api.routers.patient import router as patient_router
from app.api.routers.system_router import router as system_router
from app.api.routers.user import router as user_router


def register_routers(app: FastAPI) -> None:
    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(user_router)
    app.include_router(organisation_router)
    app.include_router(patient_router)
