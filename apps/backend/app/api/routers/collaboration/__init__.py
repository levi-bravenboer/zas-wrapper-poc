from app.api.routers.collaboration.routes import (
    appointment_collab_router,
    patient_collab_router,
    task_collab_router,
)

collaboration_routers = [
    appointment_collab_router,
    task_collab_router,
    patient_collab_router,
]

__all__ = ["collaboration_routers"]
