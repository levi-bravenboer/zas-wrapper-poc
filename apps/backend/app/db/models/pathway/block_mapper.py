"""Mapper between the `PathwayBlock` ORM row and typed `BaseBlock` domain
subclasses.

Dispatches on `row.kind` via `resolve_block_kind`. Subclass field names
map to per-kind ORM columns by `<KIND>_<field>` convention (see
`pathway-model-foundations` §2.2). Base fields (`name`, `input_logic`,
`timing_policy`) map to non-prefixed columns on the row.

The legacy fallback `legacy_to_domain` handles rows where `kind` is NULL
during the chain-slot-#1 transition by reading the deprecated `(type,
config)` pair. Removed in chain slot #2 once every consumer migrates.
"""

from __future__ import annotations

from typing import Any

from app.db.models.pathway.block import PathwayBlock
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.luscii_program.typed import ExternalProgramBlock
from app.domain.pathway.blocks.resolver import (
    is_external_program_legacy_type,
    resolve_block_kind,
)


# Fields declared on `BaseBlock` itself (not on subclasses). Mapped to
# non-prefixed columns on the ORM row.
_BASE_FIELD_TO_COLUMN: dict[str, str] = {
    "name": "label",
    "input_logic": "input_logic",
    "timing_policy": "timing_policy",
    # `lane_kind` is derived at the API layer from the joined `lane.kind`;
    # the column is not stored on `pathway_block` directly.
}

_BASE_FIELDS = frozenset(BaseBlock.model_fields.keys())


def _subclass_field_to_column(cls: type[BaseBlock], field: str) -> str:
    """`<KIND>_<field>` convention for per-kind columns."""
    return f"{cls.KIND}_{field}"


def to_domain(row: PathwayBlock) -> BaseBlock:
    """Materialise a `PathwayBlock` ORM row into its typed `BaseBlock` subclass.

    Falls back to `legacy_to_domain` if the row predates the chain-slot-#1
    backfill (i.e. `row.kind is None`).
    """
    if row.kind is None:
        return legacy_to_domain(row)

    cls = resolve_block_kind(row.kind)
    return _build_domain(cls, row)


def from_domain(block: BaseBlock) -> dict[str, Any]:
    """Return the ORM column kwargs for writing `block` to a `PathwayBlock` row.

    Caller is responsible for combining the kwargs with row-level fields
    (`id`, `pathway_version_id`, `phase_id`, `lane_id`, audit columns,
    `tenant_id`). Per-kind columns for kinds other than `block.KIND` are
    omitted from the returned dict; the caller may merge over an existing
    row's kwargs.
    """
    kwargs: dict[str, Any] = {"kind": block.KIND}

    # Base fields
    for field, column in _BASE_FIELD_TO_COLUMN.items():
        kwargs[column] = getattr(block, field)

    # Subclass-specific fields
    subclass_fields = set(type(block).model_fields.keys()) - _BASE_FIELDS
    for field in subclass_fields:
        column = _subclass_field_to_column(type(block), field)
        value = getattr(block, field)
        kwargs[column] = _serialise_value(value)

    return kwargs


def legacy_to_domain(row: PathwayBlock) -> BaseBlock:
    """Materialise a pre-backfill row from its legacy `(type, config)` pair.

    Used during the chain-slot-#1 transition for any row whose `kind`
    column is still NULL (e.g. rows written via the legacy code path
    before this slot's data backfill ran). Removed in chain slot #2.
    """
    if not row.type:
        raise ValueError(f"PathwayBlock {row.id} has no `kind` and no legacy `type`")

    cls = resolve_block_kind(row.type)
    return _build_domain_from_legacy_config(cls, row)


# --- internals ---


def _build_domain(cls: type[BaseBlock], row: PathwayBlock) -> BaseBlock:
    init_kwargs: dict[str, Any] = {}

    for field, column in _BASE_FIELD_TO_COLUMN.items():
        init_kwargs[field] = getattr(row, column)

    subclass_fields = set(cls.model_fields.keys()) - _BASE_FIELDS
    for field in subclass_fields:
        column = _subclass_field_to_column(cls, field)
        init_kwargs[field] = getattr(row, column, None)

    return cls.model_validate(init_kwargs)


def _build_domain_from_legacy_config(cls: type[BaseBlock], row: PathwayBlock) -> BaseBlock:
    """Read fields out of the legacy `config` JSONB instead of typed columns.

    Mirrors the per-kind extraction the alembic backfill performs in SQL.
    External-program rows additionally need `provider` injected (hard-coded
    to `luscii` while it's the only vendor in scope).
    """
    config = row.config or {}
    init_kwargs: dict[str, Any] = {
        "name": row.label,
        "input_logic": row.input_logic or [],
        "timing_policy": row.timing_policy,
    }

    if cls is ExternalProgramBlock and is_external_program_legacy_type(row.type):
        init_kwargs["provider"] = "luscii"

    subclass_fields = set(cls.model_fields.keys()) - _BASE_FIELDS - {"provider"}
    for field in subclass_fields:
        if field in config:
            init_kwargs[field] = config[field]

    return cls.model_validate(init_kwargs)


def _serialise_value(value: Any) -> Any:
    """Convert Pydantic submodels / lists-of-models to JSON-ready primitives."""
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_serialise_value(v) for v in value]
    return value


__all__ = [
    "from_domain",
    "legacy_to_domain",
    "to_domain",
]
