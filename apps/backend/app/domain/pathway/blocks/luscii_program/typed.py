"""ExternalProgramBlock — typed `BaseBlock` subclass.

Generic vendor-program block parameterised by a `provider` field per the
locked design decision on parent `pathway-model-redesign` (D6-adjacent: a
single class covers every external-program vendor; vendor-specific
behaviour pulls from the adapter via `provider`).

Today the only provider is `luscii`. New vendors plug in by extending the
`ExternalProvider` literal and contributing an adapter module.
"""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from app.adapters.luscii import (
    LUSCII_PROGRAM_BLOCK_TYPE,
    LUSCII_PROGRAM_KIND,
    LUSCII_PROVIDER,
)
from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_EXTERNAL
from app.schemas.pathway.blocks import BlockSourceLiteral


ExternalProvider = Literal["luscii"]
ExternalProgramMode = Literal["blocking", "fire_and_forget"]

_BLOCKING_MODES: tuple[str, ...] = ("blocking", "fire_and_forget")


class ExternalProgramBlock(BaseBlock):
    KIND: ClassVar[str] = "external_program"
    ACTOR: ClassVar[str] = "auto"
    COMPLETION: ClassVar[str] = "auto"
    # Wire-facing legacy `pathway_block.type` identifier. Diverges from
    # `KIND` because the legacy code stayed dotted (`luscii.program`)
    # while the typed-union discriminator is the kind-neutral
    # `external_program`. The compat envelope on `*BlockOut` keeps the
    # legacy code on `type`; slot #2 retires this divergence.
    TYPE_CODE: ClassVar[str] = LUSCII_PROGRAM_BLOCK_TYPE
    LABEL: ClassVar[str] = "Extern programma"
    DESCRIPTION: ClassVar[str] = "Reference to a vendor-managed care program (e.g. Luscii)."
    ICON: ClassVar[str] = "activity"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_EXTERNAL,)
    SOURCE: ClassVar[BlockSourceLiteral] = "external"
    # Catalogue-level provider / kind tags mirror the legacy
    # `BlockTypeEntry` so the builder palette keeps its per-vendor
    # grouping (`source='external'`, `provider='luscii'`,
    # `kind='program'`). The per-instance `provider` field below stays
    # the source of truth for which vendor the row belongs to; today
    # there is exactly one provider in scope so class and instance
    # agree.
    PROVIDER: ClassVar[str | None] = LUSCII_PROVIDER
    SUBKIND: ClassVar[str | None] = LUSCII_PROGRAM_KIND
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "program_id": {"type": "string", "minLength": 1, "maxLength": 128},
            "protocol_id": {"type": "string", "minLength": 1, "maxLength": 128},
            "mode": {"type": "string", "enum": list(_BLOCKING_MODES)},
        },
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["program_id", "protocol_id", "mode"],
        "widgets": {
            "program_id": "luscii-program-picker",
            "protocol_id": "luscii-protocol-picker",
        },
    }

    provider: ExternalProvider
    program_id: str | None = None
    protocol_id: str | None = None
    mode: ExternalProgramMode | None = None


# Sanity: ensure the Luscii adapter constants line up with the literal above.
# A new external provider must extend the `ExternalProvider` literal here.
assert LUSCII_PROVIDER == "luscii", "ExternalProvider literal out of sync with Luscii adapter"
assert LUSCII_PROGRAM_KIND == "program", "Luscii program kind unexpectedly changed"


__all__ = ["ExternalProgramBlock", "ExternalProgramMode", "ExternalProvider"]
