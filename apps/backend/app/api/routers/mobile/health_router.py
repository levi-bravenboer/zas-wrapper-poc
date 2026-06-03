"""Mobile-app health endpoint.

Every endpoint consumed by `apps/digital-front-door` lives under the
`/mobile/*` prefix so we can attach a single CORS rule, a single auth
middleware, and the MDR boundary at one place. This is the seed route the
mobile scaffold polls on boot.
"""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/mobile", tags=["mobile"])


class MobileHealthResponse(BaseModel):
    """Stable shape for the mobile-app liveness probe."""

    status: Literal["ok"] = "ok"


@router.get("/health", response_model=MobileHealthResponse)
def health() -> MobileHealthResponse:
    """Return a simple liveness probe payload."""
    return MobileHealthResponse()
