from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.repositories.pathway.deps import PathwayRepoDep
from app.services.pathway.pathway_service import PathwayService


def get_pathway_service(repo: PathwayRepoDep) -> PathwayService:
    return PathwayService(repo)


PathwayServiceDep = Annotated[PathwayService, Depends(get_pathway_service)]
