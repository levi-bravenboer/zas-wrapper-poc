"""Compat shim that turns a legacy `PathwayBlockIn` wire payload into ORM
kwargs for the new typed `pathway_block` columns alongside the legacy
`type` / `config` / `label` columns.

Chain slot #1 (`pathway-model-foundations`) §5: the builder keeps sending
`(type: str, config: dict)`. The write path dual-writes the same row's
new typed columns so chain slot #2 can flip the read path off the legacy
pair without a separate backfill of post-foundations rows.

`typed_shape=True` is the opt-in path exposed via the
`X-Pathway-Block-Shape: typed` request header (chain slot #1 §5.2). When
set, `config` is interpreted as the subclass's full discriminated-union
payload rather than the loose legacy bag.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.db.models.pathway.block import PathwayBlock
from app.db.models.pathway.block_mapper import from_domain, to_domain
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.luscii_program.typed import ExternalProgramBlock
from app.domain.pathway.blocks.resolver import (
    is_external_program_legacy_type,
    resolve_block_kind,
)
from app.schemas.pathway.pathway import PathwayBlockIn


def block_in_to_typed(block: PathwayBlockIn, *, typed_shape: bool = False) -> BaseBlock:
    """Materialise the wire payload as the right `BaseBlock` subclass.

    `typed_shape=False` (default, legacy): mirrors `legacy_to_domain` —
    extracts subclass fields from `config` by name.

    `typed_shape=True`: validates `config` as the full subclass payload
    (no `config` indirection). Caller has signalled the typed opt-in via
    the `X-Pathway-Block-Shape: typed` header.
    """
    cls = resolve_block_kind(block.type)
    config = block.config or {}

    if typed_shape:
        return cls.model_validate({"name": block.label or "", **config})

    init_kwargs: dict[str, Any] = {"name": block.label or ""}

    if cls is ExternalProgramBlock and is_external_program_legacy_type(block.type):
        init_kwargs["provider"] = "luscii"

    base_fields = frozenset(BaseBlock.model_fields.keys())
    subclass_fields = set(cls.model_fields.keys()) - base_fields - {"provider"}
    for field in subclass_fields:
        if field in config:
            init_kwargs[field] = config[field]

    return cls.model_validate(init_kwargs)


def block_in_to_orm_kwargs(
    block: PathwayBlockIn,
    *,
    pathway_version_id: UUID,
    lane_id: UUID,
    typed_shape: bool = False,
) -> dict[str, Any]:
    """Build the full `PathwayBlock(...)` constructor kwargs.

    Combines the row-level identity / placement fields with the typed
    per-kind columns produced by `from_domain`. Legacy `type` / `config`
    / `label` columns are retained verbatim for chain-slot-#1 dual-write
    — they are dropped in chain slot #2 once every reader is on the
    typed columns.
    """
    domain_block = block_in_to_typed(block, typed_shape=typed_shape)
    typed_kwargs = from_domain(domain_block)
    typed_kwargs.pop("label", None)  # legacy `label` carried verbatim below

    return {
        "id": block.id,
        "pathway_version_id": pathway_version_id,
        "phase_id": block.phase_id,
        "lane_id": lane_id,
        "type": block.type,
        "label": block.label,
        "duration_value_id": block.duration_value_id,
        "config": block.config,
        "x": block.x,
        "y": block.y,
        **typed_kwargs,
    }


def block_row_clone_kwargs(
    source: PathwayBlock,
    *,
    new_id: UUID,
    pathway_version_id: UUID,
    phase_id: UUID,
    lane_id: UUID,
    duration_value_id: UUID | None,
) -> dict[str, Any]:
    """Build clone kwargs for the fork-from-publish path.

    Source row already carries typed columns from chain slot #1's
    dual-write; round-trip via `to_domain` / `from_domain` keeps the
    typed payload intact while remapping identity / placement to the new
    target version.
    """
    domain_block = to_domain(source)
    typed_kwargs = from_domain(domain_block)
    typed_kwargs.pop("label", None)

    return {
        "id": new_id,
        "pathway_version_id": pathway_version_id,
        "phase_id": phase_id,
        "lane_id": lane_id,
        "type": source.type,
        "label": source.label,
        "duration_value_id": duration_value_id,
        "config": source.config,
        "x": source.x,
        "y": source.y,
        **typed_kwargs,
    }


__all__ = [
    "block_in_to_orm_kwargs",
    "block_in_to_typed",
    "block_row_clone_kwargs",
]
