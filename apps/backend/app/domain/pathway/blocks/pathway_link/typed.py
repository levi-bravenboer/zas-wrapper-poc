"""PathwayLinkBlock — typed `BaseBlock` subclass.

Internal-source block: links to another pathway version inside the same
product. The conditional-required rule (`version_pin='specific'` =>
`pinned_version_id` non-null) is enforced by `model_validator` instead of
the JSON Schema `if/then` the legacy `BlockTypeEntry` used.
"""

from __future__ import annotations

from typing import ClassVar, Literal
from uuid import UUID

from pydantic import model_validator

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM
from app.schemas.pathway.blocks import BlockSourceLiteral


PathwayLinkMode = Literal["blocking", "fire_and_forget"]
VersionPin = Literal["latest_published", "specific"]


class PathwayLinkBlock(BaseBlock):
    KIND: ClassVar[str] = "pathway_link"
    LABEL: ClassVar[str] = "Pad-koppeling"
    DESCRIPTION: ClassVar[str] = "Embeds another pathway by reference; canvas renders an inline preview."
    ICON: ClassVar[str] = "link-2"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)
    SOURCE: ClassVar[BlockSourceLiteral] = "internal"
    PROVIDER: ClassVar[str | None] = "pathway"
    SUBKIND: ClassVar[str | None] = "link"

    target_pathway_id: UUID
    mode: PathwayLinkMode
    version_pin: VersionPin = "latest_published"
    pinned_version_id: UUID | None = None
    context_mapping: dict[str, str] = {}

    @model_validator(mode="after")
    def _require_pinned_version_when_specific(self) -> "PathwayLinkBlock":
        # Conditional requirement: specific pin needs a non-null version id.
        # Mirrors the legacy JSON Schema if/then under
        # `BlockTypeEntry(type="pathway_link").config_schema`.
        if self.version_pin == "specific" and self.pinned_version_id is None:
            raise ValueError("pinned_version_id is required when version_pin='specific'")
        return self


__all__ = ["PathwayLinkBlock", "PathwayLinkMode", "VersionPin"]
