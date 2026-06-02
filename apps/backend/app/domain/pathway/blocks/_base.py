"""Shared primitives for the pathway block-type registry.

The block-type entry shape (`BlockTypeEntry`) and the semantics dispatch
enum live here. Concrete `BlockTypeEntry` instances live in per-kind
modules under `app/domain/pathway/blocks/<kind>/block.py`.

The generic JSON Schema helper (`object_schema`) lives one level up in
`app/domain/pathway/_helpers.py` because it's shared by both block and
edge registries.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any

from app.schemas.pathway.blocks import (
    BlockSourceLiteral as BlockSource,
    NestedRenderLiteral as NestedRender,
)


# Shared link-mode enum reused across every block whose runtime semantics
# include "do I wait for the linked execution to finish, or fire and continue?"
# Today: `pathway_link` + `luscii.program`. Future link-shaped blocks (HiX
# task delegation, registry follow-up) plug in here without a new constant.
BLOCKING_MODES: tuple[str, ...] = ("blocking", "fire_and_forget")


class BlockSemantics(str, enum.Enum):
    APPOINTMENT = "appointment"
    TASK = "task"
    MESSAGE = "message"
    FORM = "form"
    DECISION = "decision"
    MILESTONE = "milestone"
    WAIT = "wait"
    PATHWAY_LINK = "pathway_link"
    # External-provider blocks whose body is a reference to a vendor program
    # (e.g. a Luscii care path). Dispatch key shared across vendors so the
    # builder inspector picks the provider-specific React component from an
    # inner `{provider: Component}` map — no per-vendor switch in
    # `BuilderDrawer`. See `openspec/changes/external-block-integrations/design.md`.
    EXTERNAL_PROGRAM = "external_program"


@dataclass(frozen=True, slots=True)
class BlockTypeEntry:
    type: str
    label: str
    semantics: BlockSemantics
    icon: str
    # First entry is the default placement when no explicit lane context exists.
    allowed_lane_kind_codes: tuple[str, ...]
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any] = field(default_factory=dict)
    supports_branches: bool = False
    # Provenance — drives frontend palette grouping + per-provider thumbnail
    # / inspector dispatch. Native blocks default to source='native' with no
    # provider/kind. External blocks contributed via dotted codes (e.g.
    # `luscii.program`) declare source='external' + the provider/kind pair
    # parsed from the dotted code. Internal-source blocks (today only
    # `pathway_link`) carry synthetic provider/kind tags for palette symmetry.
    source: BlockSource = "native"
    provider: str | None = None
    kind: str | None = None
    # UI hint for blocks whose body is a nested reference (today: `pathway_link`).
    # `inline_preview` = collapsible container that renders a child summary;
    # `collapsed_card` = single card requiring drill-down. None for non-nested blocks.
    nested_render: NestedRender | None = None


__all__ = [
    "BLOCKING_MODES",
    "BlockSemantics",
    "BlockTypeEntry",
]
