from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository


def get_pathway_repository(session: SessionDep) -> PathwayRepository:
    return PathwayRepository(session)


def get_pathway_version_repository(session: SessionDep) -> PathwayVersionRepository:
    return PathwayVersionRepository(session)


PathwayRepoDep = Annotated[PathwayRepository, Depends(get_pathway_repository)]
PathwayVersionRepoDep = Annotated[
    PathwayVersionRepository, Depends(get_pathway_version_repository)
]
