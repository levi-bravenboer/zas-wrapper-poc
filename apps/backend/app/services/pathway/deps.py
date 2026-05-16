from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.repositories.pathway.deps import PathwayRepoDep, PathwayVersionRepoDep
from app.services.pathway.pathway_service import PathwayService
from app.services.pathway.pathway_version_service import PathwayVersionService


def get_pathway_service(
    repo: PathwayRepoDep,
    version_repo: PathwayVersionRepoDep,
) -> PathwayService:
    return PathwayService(repo, version_repo)


def get_pathway_version_service(
    repo: PathwayRepoDep,
    version_repo: PathwayVersionRepoDep,
) -> PathwayVersionService:
    return PathwayVersionService(repo, version_repo)


PathwayServiceDep = Annotated[PathwayService, Depends(get_pathway_service)]
PathwayVersionServiceDep = Annotated[
    PathwayVersionService, Depends(get_pathway_version_service)
]
