"""Write-side materialiser for `PathwayBlockIn` (chain slot #2 §6).

The slot-#1 compat shim that dual-wrote legacy `(type, config)` columns
is retired. Slot #2 always interprets `block.config` as the typed
`BaseBlock` subclass payload — including the shared `name`,
`input_logic`, and `timing_policy` fields plus the per-kind typed
fields. `block.kind` is the discriminator (`luscii.program` still
resolves via `resolver._LEGACY_TYPE_ALIASES` for storage parity).

The ORM no longer carries `type` / `config` / `label`; this module
projects directly onto the typed columns produced by `from_domain`.
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


def block_in_to_typed(block: PathwayBlockIn) -> BaseBlock:
    """Materialise the wire payload as the right `BaseBlock` subclass.

    `config` is validated as the full subclass payload (the slot-#1
    loose-bag fallback is retired in slot #2 §6). Callers may pass
    `label` at the top level as a convenience — the shim folds it
    into `config["name"]` if `name` isn't already there. External-
    program rows still inject `provider='luscii'` when the wire
    carries the dotted legacy code so the typed instance is
    constructible without the builder having to write the field
    explicitly.
    """
    cls = resolve_block_kind(block.kind)
    config = block.config or {}
    init_kwargs: dict[str, Any] = dict(config)
    if "name" not in init_kwargs:
        init_kwargs["name"] = block.label or ""
    if cls is ExternalProgramBlock and is_external_program_legacy_type(block.kind):
        init_kwargs.setdefault("provider", "luscii")
    return cls.model_validate(init_kwargs)


def block_in_to_orm_kwargs(
    block: PathwayBlockIn,
    *,
    pathway_version_id: UUID,
    lane_id: UUID,
) -> dict[str, Any]:
    """Build the full `PathwayBlock(...)` constructor kwargs.

    Combines the row-level identity / placement fields with the typed
    per-kind columns produced by `from_domain`. The slot-#1 legacy
    `type` / `config` / `label` ORM columns are retired in slot #2 §6
    — no dual-write here.
    """
    domain_block = block_in_to_typed(block)
    typed_kwargs = from_domain(domain_block)

    return {
        "id": block.id,
        "pathway_version_id": pathway_version_id,
        "phase_id": block.phase_id,
        "lane_id": lane_id,
        "duration_value_id": block.duration_value_id,
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
    block_id_map: dict[UUID, UUID] | None = None,
) -> dict[str, Any]:
    """Build clone kwargs for the fork-from-publish path.

    `block_id_map` (source-row-id → target-row-id) rewrites every
    `input_logic.rules[].node` and `args.after_block` so cloned
    connectivity points at the cloned block ids — without it,
    cloned `input_logic` stays bound to the source version's ids.
    """
    domain_block = to_domain(source)
    typed_kwargs = from_domain(domain_block)

    if block_id_map is not None and isinstance(typed_kwargs.get("input_logic"), dict):
        typed_kwargs["input_logic"] = _remap_input_logic_nodes(
            typed_kwargs["input_logic"], block_id_map
        )

    return {
        "id": new_id,
        "pathway_version_id": pathway_version_id,
        "phase_id": phase_id,
        "lane_id": lane_id,
        "duration_value_id": duration_value_id,
        "x": source.x,
        "y": source.y,
        **typed_kwargs,
    }


def _remap_input_logic_nodes(
    input_logic: dict[str, Any], block_id_map: dict[UUID, UUID]
) -> dict[str, Any]:
    """Rewrite `node` + `args.after_block` UUIDs in every rule."""
    rules_in = input_logic.get("rules") or []
    rules_out: list[dict[str, Any]] = []
    for rule in rules_in:
        if not isinstance(rule, dict):
            rules_out.append(rule)
            continue
        new_rule = dict(rule)
        node = new_rule.get("node")
        mapped = _try_remap(node, block_id_map)
        if mapped is not None:
            new_rule["node"] = mapped
        args = new_rule.get("args")
        if isinstance(args, dict):
            new_args = dict(args)
            after = new_args.get("after_block")
            mapped_after = _try_remap(after, block_id_map)
            if mapped_after is not None:
                new_args["after_block"] = mapped_after
            new_rule["args"] = new_args
        rules_out.append(new_rule)
    return {**input_logic, "rules": rules_out}


def _try_remap(value: Any, block_id_map: dict[UUID, UUID]) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        as_uuid = UUID(value)
    except ValueError:
        return None
    mapped = block_id_map.get(as_uuid)
    return str(mapped) if mapped is not None else None


__all__ = [
    "block_in_to_orm_kwargs",
    "block_in_to_typed",
    "block_row_clone_kwargs",
]
