from fastapi import FastAPI

from app import __version__
from app.api import register_routers


def create_app() -> FastAPI:
    app = FastAPI(
        title="ZAS Wrapper Backend",
        version=__version__,
        description="FHIR gateway and orchestrator backend for the ZAS Telegeneeskunde POC.",
    )
    register_routers(app)
    return app


app = create_app()
