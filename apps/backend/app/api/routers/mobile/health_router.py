"""Mobile-app health endpoint.

Every endpoint consumed by `apps/digital-front-door` lives under the
`/mobile/*` prefix so we can attach a single CORS rule, a single auth
middleware, and the MDR boundary at one place. This is the seed route the
mobile scaffold polls on boot.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/mobile", tags=["mobile"])


@router.get("/health")
def health() -> dict[str, str]:
    """Return a simple liveness probe payload."""
    return {"status": "ok"}
