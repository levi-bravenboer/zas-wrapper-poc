"""Cross-cutting Luscii identifiers.

Single source of truth for the provider / kind / dotted-block-type-code
trio. Mirrors the frontend constants in
``apps/orchestrator/src/modules/pathway/components/canvas/nodes/external/luscii/types.ts``
(LUSCII_PROVIDER / LUSCII_PROGRAM_KIND / LUSCII_PROGRAM_BLOCK_TYPE).

Imported by:

- ``app.domain.pathway.blocks.luscii_program`` — luscii.program catalogue entry
- ``app.services.luscii.*`` — service-layer references
- Tests — never hard-code these literals; import from here

Future Luscii kinds (none planned today) add a new ``LUSCII_<KIND>_KIND``
constant alongside ``LUSCII_PROGRAM_KIND`` and a matching
``LUSCII_<KIND>_BLOCK_TYPE`` derived from ``LUSCII_PROVIDER``.
"""

from __future__ import annotations

from typing import Final

LUSCII_PROVIDER: Final = "luscii"
LUSCII_PROGRAM_KIND: Final = "program"
LUSCII_PROGRAM_BLOCK_TYPE: Final = f"{LUSCII_PROVIDER}.{LUSCII_PROGRAM_KIND}"

# Synthetic-id prefix on every stub program. Used by tests asserting that
# our seed data never collides with real Luscii ids and by future audit /
# logging to flag stub payloads in flight.
LUSCII_STUB_ID_PREFIX: Final = "luscii-"
