"""Pathway block-type registry — typed-subclass derived.

The legacy `BlockTypeEntry` data registry (`_base.py`,
`<kind>/block.py`) has been retired per
`pathway-model-foundations` §1.4 / §7.1. The wire-facing catalogue is
now derived from the typed `BaseBlock` subclasses via
`block_catalogue.BLOCK_CATALOGUE`, with `get_catalogue_entry` as the
`get_block_type` replacement for callers that need a code → entry
lookup.

Adding a new block kind:
1. Create `app/domain/pathway/blocks/<kind>/typed.py` with a
   `BaseBlock` subclass that declares `KIND`, `TYPE_CODE`, `LABEL`,
   `ICON`, `allowed_lane_kinds`, `CONFIG_SCHEMA`, `UI_SCHEMA`, and
   any per-kind typed fields.
2. Append it to `resolver.BLOCK_CLASSES` so the catalogue picks it
   up and the storage mapper can materialise it.
3. Add tests under `tests/domain/pathway/test_block_classes.py`.
"""

from __future__ import annotations

from app.domain.pathway.blocks.catalogue import (
    BLOCK_CATALOGUE,
    get_block_class_for_type_code,
    get_catalogue_entry,
)


__all__ = [
    "BLOCK_CATALOGUE",
    "get_block_class_for_type_code",
    "get_catalogue_entry",
]
