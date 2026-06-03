"""Pathway block-type registry.

Aggregates one `BlockTypeEntry` instance per block kind into the
`BLOCK_TYPES` tuple and exposes `get_block_type` for name → entry lookup.

Adding a new block kind:
1. Create `app/domain/pathway/blocks/<kind>/block.py` exporting `BLOCK`.
2. Add a thin re-export in `<kind>/__init__.py`.
3. Register it in the import list below and append to the `BLOCK_TYPES`
   tuple.
4. Add tests under `tests/domain/pathway/test_blocks.py`.
"""

from __future__ import annotations

from app.domain.pathway.blocks._base import BlockTypeEntry
from app.domain.pathway.blocks.appointment import BLOCK as APPOINTMENT
from app.domain.pathway.blocks.decision import BLOCK as DECISION
from app.domain.pathway.blocks.form import BLOCK as FORM
from app.domain.pathway.blocks.luscii_program import BLOCK as LUSCII_PROGRAM
from app.domain.pathway.blocks.message import BLOCK as MESSAGE
from app.domain.pathway.blocks.milestone import BLOCK as MILESTONE
from app.domain.pathway.blocks.pathway_link import BLOCK as PATHWAY_LINK
from app.domain.pathway.blocks.task import BLOCK as TASK
from app.domain.pathway.blocks.wait import BLOCK as WAIT


BLOCK_TYPES: tuple[BlockTypeEntry, ...] = (
    APPOINTMENT,
    TASK,
    MESSAGE,
    FORM,
    DECISION,
    MILESTONE,
    WAIT,
    PATHWAY_LINK,
    LUSCII_PROGRAM,
)


_BLOCK_TYPES_BY_NAME: dict[str, BlockTypeEntry] = {entry.type: entry for entry in BLOCK_TYPES}


def get_block_type(type_name: str) -> BlockTypeEntry | None:
    return _BLOCK_TYPES_BY_NAME.get(type_name)


__all__ = [
    "BLOCK_TYPES",
    "get_block_type",
]
