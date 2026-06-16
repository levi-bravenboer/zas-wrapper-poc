from fastapi import FastAPI

from app.api.routers.access import router as access_router
from app.api.routers.audit import router as audit_router
from app.api.routers.auth import router as auth_router
from app.api.routers.care_team import router as care_team_router
from app.api.routers.events_router import router as events_router
from app.api.routers.luscii import router as luscii_router
from app.api.routers.mobile import router as mobile_router
from app.api.routers.mobile.auth import auth_router as mobile_auth_router
from app.api.routers.organisation import router as organisation_router
from app.api.routers.pathway import router as pathway_router
from app.api.routers.pathway.enrollment_router import router as enrollment_router
from app.api.routers.patient import luscii_data_router as patient_luscii_router
from app.api.routers.patient import router as patient_router
from app.api.routers.practitioner import router as practitioner_router
from app.api.routers.practitioner_role import router as practitioner_role_router
from app.api.routers.system_router import router as system_router
from app.api.routers.task import router as task_router
from app.api.routers.user import router as user_router


def register_routers(app: FastAPI) -> None:
    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(user_router)
    app.include_router(organisation_router)
    app.include_router(patient_router)
    app.include_router(patient_luscii_router)
    app.include_router(access_router)
    app.include_router(audit_router)
    app.include_router(care_team_router)
    app.include_router(practitioner_router)
    app.include_router(practitioner_role_router)
    app.include_router(events_router)
    app.include_router(task_router)
    app.include_router(pathway_router)
    app.include_router(enrollment_router)
    app.include_router(luscii_router)
    app.include_router(mobile_router)
    app.include_router(mobile_auth_router)
