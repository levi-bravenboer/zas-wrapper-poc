from fastapi import APIRouter, Request

router = APIRouter(tags=["system"])


@router.get("/", operation_id="get_root_metadata")
def root(request: Request) -> dict[str, str]:
    app = request.app
    return {"name": app.title, "version": app.version}


@router.get("/health", operation_id="get_health")
def health() -> dict[str, str]:
    return {"status": "ok"}
