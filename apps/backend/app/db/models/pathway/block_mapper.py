"""Mapper between the `PathwayBlock` ORM row and typed `BaseBlock` domain
subclasses.

Dispatches on `row.kind` via `resolve_block_kind`. Subclass field names
map to per-kind ORM columns by `<KIND>_<field>` convention (see
`pathway-model-foundations` §2.2). Base fields (`name`, `input_logic`,
`timing_policy`) map to non-prefixed columns on the row.

The slot-#1 legacy `(type, config)` fallback is retired in slot #2 §6;
rows without `kind` raise on read. The alembic upgrade backfills the
discriminator before promoting the column to NOT NULL.
"""

from __future__ import annotations

from typing import Any

from app.db.models.pathway.block import PathwayBlock
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.resolver import resolve_block_kind


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

    Slot #2 §6 retires the `(type, config)` legacy fallback; rows
    without `kind` are rejected. The alembic upgrade backfills the
    column for every pre-slot-#2 row before promoting it to NOT NULL.
    """
    if row.kind is None:
        raise ValueError(
            f"PathwayBlock {row.id} has no `kind` discriminator — slot #2 §6 retired the "
            "legacy `(type, config)` fallback. Run the slot #2 alembic upgrade to backfill."
        )
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

    # Base fields. Pass each through `_serialise_value` so Pydantic
    # submodels (e.g. `BaseBlock.input_logic: InputLogic`) land as JSON
    # primitives on the JSONB column rather than as live Python
    # objects the driver can't encode.
    for field, column in _BASE_FIELD_TO_COLUMN.items():
        kwargs[column] = _serialise_value(getattr(block, field))

    # Subclass-specific fields
    subclass_fields = set(type(block).model_fields.keys()) - _BASE_FIELDS
    for field in subclass_fields:
        column = _subclass_field_to_column(type(block), field)
        value = getattr(block, field)
        kwargs[column] = _serialise_value(value)

    # Slot #2 §4: split `timing_policy` onto the typed columns so the
    # read path can dispatch on the discriminator without
    # re-validating JSONB. The JSONB column is still written by the
    # base-field loop above for back-compat.
    kwargs.update(_timing_policy_to_columns(block.timing_policy))

    return kwargs


# --- internals ---


def _build_domain(cls: type[BaseBlock], row: PathwayBlock) -> BaseBlock:
    init_kwargs: dict[str, Any] = {}

    for field, column in _BASE_FIELD_TO_COLUMN.items():
        init_kwargs[field] = getattr(row, column)
    # `BaseBlock.name` is non-null; legacy rows whose `label` column was
    # nullable (slot #1 dual-write) coerce to empty string here so the
    # typed read path doesn't fail on demo seeds that pre-date the
    # `label` requirement. Slot #2 enforces non-null at the column level.
    if init_kwargs.get("name") is None:
        init_kwargs["name"] = ""
    # Slot #2: `input_logic` is the typed `InputLogic` aggregate
    # stored as JSONB. Slot #1 wrote a bare `list[dict]` stub default
    # — coerce that into the empty aggregate shape so Pydantic
    # validation succeeds against the new typed field. New rows
    # always carry the dict shape via the migrated server default.
    init_kwargs["input_logic"] = _normalise_input_logic(init_kwargs.get("input_logic"))
    # Slot #2 §4: `timing_policy` is the tagged `TimingPolicy` union,
    # persisted across discrete typed columns. The mapper reads the
    # discriminator + per-variant column to reconstruct the union
    # member, or falls back to `None` for rows the §4 backfill hasn't
    # touched yet.
    init_kwargs["timing_policy"] = _timing_policy_from_row(row)

    subclass_fields = set(cls.model_fields.keys()) - _BASE_FIELDS
    for field in subclass_fields:
        column = _subclass_field_to_column(cls, field)
        init_kwargs[field] = getattr(row, column, None)

    return cls.model_validate(init_kwargs)


def _normalise_input_logic(value: Any) -> dict[str, Any]:
    """Bridge slot #1 list-stub rows onto the slot #2 aggregate shape.

    The legacy server default was `'[]'::jsonb` (matching the old
    `BaseBlock.input_logic: list[dict[str, Any]]` stub). The
    slot #2 alembic migration rewrites every row to the aggregate
    shape, but this guard keeps the mapper tolerant of any straggler
    rows the migration missed (e.g. seeded test fixtures rebuilt
    from a slot #1 dump).
    """
    if value is None or value == []:
        return {"rules": [], "aggregator": "all_of"}
    if isinstance(value, list):
        # Defensive: callers that still write a raw list (e.g. legacy
        # backfill code paths) get wrapped without losing the rules.
        return {"rules": value, "aggregator": "all_of"}
    if isinstance(value, dict):
        return value
    raise ValueError(f"unsupported input_logic shape: {type(value).__name__}")


def _timing_policy_from_row(row: PathwayBlock) -> dict[str, Any] | None:
    """Reconstruct the `TimingPolicy` dict from the typed slot-#2 columns.

    Returns `None` when the row carries no policy (`timing_policy_kind
    IS NULL`) — matches the `BaseBlock.timing_policy` default. The
    return value is a Pydantic-validatable dict so callers feed it
    through `cls.model_validate` to land on the typed union member.
    """
    # `getattr` with a default keeps the mapper tolerant of test
    # fixtures + legacy snapshots that pre-date the slot-#2 typed
    # timing columns. Production rows always carry the columns once
    # the §4 alembic revision lands.
    kind = getattr(row, "timing_policy_kind", None)
    if kind is None:
        return None
    if kind == "fixed_duration":
        return {
            "kind": kind,
            "duration_iso": getattr(row, "timing_duration_iso", None) or "PT0S",
        }
    if kind == "wait_after":
        return {
            "kind": kind,
            "offset_iso": getattr(row, "timing_offset_iso", None) or "PT0S",
        }
    if kind == "due_within":
        return {
            "kind": kind,
            "window_iso": getattr(row, "timing_window_iso", None) or "PT0S",
        }
    if kind == "at_enrollment_picked_date":
        return {"kind": kind}
    raise ValueError(f"unknown timing_policy_kind: {kind!r}")


def _timing_policy_to_columns(policy: Any) -> dict[str, Any]:
    """Project a `TimingPolicy` instance back into typed column kwargs.

    Accepts either a Pydantic model instance or a pre-dumped dict
    (the typed-blocks rebuild path goes through `model_dump`). Unset
    policy maps to all-NULL columns.
    """
    if policy is None:
        return {
            "timing_policy_kind": None,
            "timing_offset_iso": None,
            "timing_window_iso": None,
            "timing_duration_iso": None,
        }
    if hasattr(policy, "model_dump"):
        policy = policy.model_dump(mode="json")
    assert isinstance(policy, dict)
    kind = policy.get("kind")
    columns: dict[str, Any] = {
        "timing_policy_kind": kind,
        "timing_offset_iso": None,
        "timing_window_iso": None,
        "timing_duration_iso": None,
    }
    if kind == "fixed_duration":
        columns["timing_duration_iso"] = policy.get("duration_iso")
    elif kind == "wait_after":
        columns["timing_offset_iso"] = policy.get("offset_iso", "PT0S")
    elif kind == "due_within":
        columns["timing_window_iso"] = policy.get("window_iso")
    elif kind == "at_enrollment_picked_date":
        pass
    else:
        raise ValueError(f"unknown timing_policy_kind: {kind!r}")
    return columns


def _serialise_value(value: Any) -> Any:
    """Convert Pydantic submodels / lists-of-models to JSON-ready primitives."""
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_serialise_value(v) for v in value]
    return value


__all__ = [
    "from_domain",
    "to_domain",
]
