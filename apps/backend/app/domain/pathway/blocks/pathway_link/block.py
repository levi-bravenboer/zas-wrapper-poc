from __future__ import annotations

from app.domain.pathway.blocks._base import (
    BLOCKING_MODES,
    BlockSemantics,
    BlockTypeEntry,
)
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


# Internal-source block: target lives inside our own product. The synthetic
# `provider='pathway'`, `kind='link'` tags exist so palette grouping and the
# inspector header chip dispatch behave uniformly with external blocks
# (see `external-block-integrations`).
#
# The config schema is hand-rolled rather than going through `object_schema`
# because it carries a JSON Schema `if/then` for the conditional requirement
# on `pinned_version_id` — `object_schema` only builds the bare object form.
BLOCK = BlockTypeEntry(
    type="pathway_link",
    label="Pad-koppeling",
    semantics=BlockSemantics.PATHWAY_LINK,
    icon="link-2",
    allowed_lane_kind_codes=(LANE_KIND_SYSTEM,),
    source="internal",
    provider="pathway",
    kind="link",
    nested_render="inline_preview",
    config_schema={
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "target_pathway_id": {"type": "string", "format": "uuid"},
            "mode": {"type": "string", "enum": list(BLOCKING_MODES)},
            # Version-pin governs which child version this link resolves to
            # at snapshot/publish time. `latest_published` re-resolves at
            # every publish of the parent; `specific` freezes to
            # `pinned_version_id`. Cross-DB ownership of `pinned_version_id`
            # is enforced in the service layer (see `pathway_service`).
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
        # Conditional requirement: when version_pin='specific',
        # pinned_version_id MUST be a non-null UUID. JSON Schema Draft 2020-12
        # `if/then` expresses this cleanly so `_validate_block_config` rejects
        # the missing-id case without a Python branch.
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
    },
    ui_schema={
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
    },
)


__all__ = ["BLOCK"]
