from app.api.routers.patient.luscii_router import router as luscii_data_router
from app.api.routers.patient.observation_router import router as observation_router
from app.api.routers.patient.patient_router import router

__all__ = ["luscii_data_router", "observation_router", "router"]
