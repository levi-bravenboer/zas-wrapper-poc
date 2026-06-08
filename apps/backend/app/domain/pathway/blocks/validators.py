"""Publish-time validators for `BaseBlock` subclasses.

These checks run on the class itself (not instances) so they can be
exercised at import time in tests and at publish time before a pathway
version transitions to `published`. Each validator raises a typed
exception named in `pathway-model-foundations/spec.md`.
"""

from __future__ import annotations

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.resolver import BLOCK_CLASSES


class DeferredFieldAttrUnknownError(LookupError):
    """`DEFERRED_FIELDS` entry references a field absent on the subclass.

    See `pathway-model-foundations/spec.md` scenario
    "DeferredFieldSpec.attr must reference a real subclass field".
    """

    def __init__(self, block_cls: type[BaseBlock], attr: str) -> None:
        super().__init__(
            f"{block_cls.__name__}.DEFERRED_FIELDS references unknown attr "
            f"'{attr}' (not a model field on the subclass)"
        )
        self.block_cls = block_cls
        self.attr = attr


def validate_deferred_field_attrs(block_cls: type[BaseBlock]) -> None:
    """Raise `DeferredFieldAttrUnknownError` for any unknown `attr`.

    Every `DeferredFieldSpec.attr` MUST name a real Pydantic v2 model
    field on `block_cls`. This is the class-level invariant guarded by
    D4 (deferred-field representation).
    """
    fields = block_cls.model_fields
    for spec in block_cls.DEFERRED_FIELDS:
        if spec.attr not in fields:
            raise DeferredFieldAttrUnknownError(block_cls, spec.attr)


def validate_all_block_classes() -> None:
    """Run every class-level validator across the catalogue.

    Used by import-time tests and the publish flow. Stops on the first
    failure; surface all errors by iterating with a try/except in the
    caller if needed.
    """
    for cls in BLOCK_CLASSES:
        validate_deferred_field_attrs(cls)


__all__ = [
    "DeferredFieldAttrUnknownError",
    "validate_all_block_classes",
    "validate_deferred_field_attrs",
]
