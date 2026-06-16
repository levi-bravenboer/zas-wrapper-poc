"""Block-type catalogue derived from the typed `BaseBlock` hierarchy.

Replaces the data-driven `BLOCK_TYPES` list of `BlockTypeEntry`
instances (chain slot #1 §1.4 / §7.1). Each `PathwayBlockType` entry
the API surfaces — `GET /pathways/blocks`, the inspector schema-form
renderer, the publish-time `_validate_block_config` walker — is now a
projection of the per-kind subclass's `ClassVar` metadata
(`TYPE_CODE`, `LABEL`, `ICON`, `allowed_lane_kinds`, `CONFIG_SCHEMA`,
`UI_SCHEMA`, `SOURCE`, `PROVIDER`, `SUBKIND`, `NESTED_RENDER`,
`SUPPORTS_BRANCHES`).

The catalogue is rebuilt lazily on first import; the per-kind subclass
ordering follows `resolver.BLOCK_CLASSES` so palette / list ordering
stays stable across deployments.
"""

from __future__ import annotations

from typing import cast

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.resolver import BLOCK_CLASSES
from app.schemas.pathway.blocks import (
    BlockSemanticsLiteral,
    NestedRenderLiteral,
    PathwayBlockType,
)


def _block_class_to_catalogue_entry(cls: type[BaseBlock]) -> PathwayBlockType:
    """Project one `BaseBlock` subclass into its catalogue entry."""
    semantics = cast(BlockSemanticsLiteral, cls.KIND)
    nested_render = cast(NestedRenderLiteral | None, cls.NESTED_RENDER)
    return PathwayBlockType(
        type=cls.TYPE_CODE or cls.KIND,
        label=cls.LABEL,
        semantics=semantics,
        icon=cls.ICON,
        allowed_lane_kind_codes=list(cls.allowed_lane_kinds),
        config_schema=dict(cls.CONFIG_SCHEMA),
        ui_schema=dict(cls.UI_SCHEMA),
        supports_branches=cls.SUPPORTS_BRANCHES,
        source=cls.SOURCE,
        provider=cls.PROVIDER,
        kind=cls.SUBKIND,
        nested_render=nested_render,
    )


BLOCK_CATALOGUE: tuple[PathwayBlockType, ...] = tuple(
    _block_class_to_catalogue_entry(cls) for cls in BLOCK_CLASSES
)

_BY_TYPE_CODE: dict[str, PathwayBlockType] = {entry.type: entry for entry in BLOCK_CATALOGUE}
_CLASS_BY_TYPE_CODE: dict[str, type[BaseBlock]] = {
    (cls.TYPE_CODE or cls.KIND): cls for cls in BLOCK_CLASSES
}


def get_catalogue_entry(type_code: str) -> PathwayBlockType | None:
    """Return the catalogue entry for a wire `pathway_block.type` code.

    Mirrors the retired `get_block_type` signature so callers swap with
    minimal noise. Returns `None` for unknown codes so callers can
    distinguish missing-from-catalogue from validation errors.
    """
    return _BY_TYPE_CODE.get(type_code)


def get_block_class_for_type_code(type_code: str) -> type[BaseBlock] | None:
    """Return the `BaseBlock` subclass for a wire `type` code.

    Convenience for callers that want both the catalogue entry and the
    typed class without going through `resolve_block_kind` (which
    accepts both kind and legacy aliases). Returns `None` when the
    code isn't in the canonical catalogue map; the resolver still
    handles legacy aliases for the storage layer.
    """
    return _CLASS_BY_TYPE_CODE.get(type_code)


__all__ = [
    "BLOCK_CATALOGUE",
    "get_block_class_for_type_code",
    "get_catalogue_entry",
]
