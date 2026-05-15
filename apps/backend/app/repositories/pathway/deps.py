from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.pathway.pathway_repository import PathwayRepository


def get_pathway_repository(session: SessionDep) -> PathwayRepository:
    return PathwayRepository(session)


PathwayRepoDep = Annotated[PathwayRepository, Depends(get_pathway_repository)]
