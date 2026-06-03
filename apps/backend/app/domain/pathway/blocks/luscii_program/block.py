"""External-provider block: Luscii Program.

Stores a reference to a Luscii care path (``program_id`` + ``protocol_id``)
plus the wait mode; everything else (instruments, thresholds, schedule,
education) is authored inside Luscii Builder and is read-only here.
Per-patient values (BSN, contact, locale) are filled at runtime by the
caregiver, not at design-time — see the external-block-integrations design
note "Per-patient values stay at enrollment runtime".

Vendor primitives (`LUSCII_PROGRAM_BLOCK_TYPE`, `LUSCII_PROVIDER`,
`LUSCII_PROGRAM_KIND`) live in the Luscii adapter; this block file imports
them so the wire identifiers remain owned by the adapter.
"""

from __future__ import annotations

from app.adapters.luscii import (
    LUSCII_PROGRAM_BLOCK_TYPE,
    LUSCII_PROGRAM_KIND,
    LUSCII_PROVIDER,
)
from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks._base import (
    BLOCKING_MODES,
    BlockSemantics,
    BlockTypeEntry,
)
from app.domain.pathway.lanes import LANE_KIND_EXTERNAL


BLOCK = BlockTypeEntry(
    type=LUSCII_PROGRAM_BLOCK_TYPE,
    label="Luscii Program",
    semantics=BlockSemantics.EXTERNAL_PROGRAM,
    icon="activity",
    allowed_lane_kind_codes=(LANE_KIND_EXTERNAL,),
    source="external",
    provider=LUSCII_PROVIDER,
    kind=LUSCII_PROGRAM_KIND,
    # No `required` here — autosave persists drafts mid-edit (program picked
    # but no protocol yet). Publish-time validation (Phase 5) re-asserts
    # completeness against the same three keys.
    config_schema=object_schema(
        properties={
            "program_id": {"type": "string", "minLength": 1, "maxLength": 128},
            "protocol_id": {"type": "string", "minLength": 1, "maxLength": 128},
            "mode": {"type": "string", "enum": list(BLOCKING_MODES)},
        },
    ),
    ui_schema={
        "order": ["program_id", "protocol_id", "mode"],
        "widgets": {
            "program_id": "luscii-program-picker",
            "protocol_id": "luscii-protocol-picker",
        },
    },
)


__all__ = ["BLOCK"]
