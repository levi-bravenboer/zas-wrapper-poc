"""PathwayLinkBlock — typed `BaseBlock` subclass.

Internal-source block: links to another pathway version inside the same
product. The conditional-required rule (`version_pin='specific'` =>
`pinned_version_id` non-null) is enforced by `model_validator` instead of
the JSON Schema `if/then` the legacy `BlockTypeEntry` used.
"""

from __future__ import annotations

from typing import Any, ClassVar, Literal
from uuid import UUID

from pydantic import model_validator

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM
from app.schemas.pathway.blocks import BlockSourceLiteral, NestedRenderLiteral


PathwayLinkMode = Literal["blocking", "fire_and_forget"]
VersionPin = Literal["latest_published", "specific"]

_BLOCKING_MODES: tuple[str, ...] = ("blocking", "fire_and_forget")


class PathwayLinkBlock(BaseBlock):
    KIND: ClassVar[str] = "pathway_link"
    TYPE_CODE: ClassVar[str] = "pathway_link"
    LABEL: ClassVar[str] = "Pad-koppeling"
    DESCRIPTION: ClassVar[str] = "Embeds another pathway by reference; canvas renders an inline preview."
    ICON: ClassVar[str] = "link-2"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)
    SOURCE: ClassVar[BlockSourceLiteral] = "internal"
    PROVIDER: ClassVar[str | None] = "pathway"
    SUBKIND: ClassVar[str | None] = "link"
    NESTED_RENDER: ClassVar[NestedRenderLiteral | None] = "inline_preview"
    # Hand-rolled JSON Schema rather than `object_schema` because of the
    # conditional `if/then` requirement on `pinned_version_id` when
    # `version_pin='specific'`. The same invariant is also enforced by
    # `_require_pinned_version_when_specific` at the typed-instance
    # layer; the JSON Schema is the wire-level mirror for autosave.
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "target_pathway_id": {"type": "string", "format": "uuid"},
            "mode": {"type": "string", "enum": list(_BLOCKING_MODES)},
            "version_pin": {
                "type": "string",
                "enum": ["latest_published", "specific"],
                "default": "latest_published",
            },
            "pinned_version_id": {
                "type": ["string", "null"],
                "format": "uuid",
            },
            "context_mapping": {
                "type": "object",
                "additionalProperties": {"type": "string"},
            },
        },
        "required": ["target_pathway_id", "mode"],
        "if": {
            "properties": {"version_pin": {"const": "specific"}},
            "required": ["version_pin"],
        },
        "then": {
            "properties": {
                "pinned_version_id": {"type": "string", "format": "uuid"},
            },
            "required": ["pinned_version_id"],
        },
    }
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": [
            "target_pathway_id",
            "mode",
            "version_pin",
            "pinned_version_id",
            "context_mapping",
        ],
        "widgets": {
            "target_pathway_id": "pathway-picker",
            "version_pin": "version-pin-radio",
            "pinned_version_id": "pathway-version-picker",
        },
    }

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
