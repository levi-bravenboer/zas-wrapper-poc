"""Class-level validators for `BaseBlock` subclasses (chain slot #1).

Guards the spec scenario "DeferredFieldSpec.attr must reference a real
subclass field" (`pathway-model-foundations/spec.md` Requirement
"Class-level DeferredFieldSpec declarations").
"""

from __future__ import annotations

from typing import ClassVar

import pytest

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.deferred import DeferredFieldSpec
from app.domain.pathway.blocks.validators import (
    DeferredFieldAttrUnknownError,
    validate_all_block_classes,
    validate_deferred_field_attrs,
)
from app.domain.pathway.lanes import LANE_KIND_CAREGIVER


class _GoodBlock(BaseBlock):
    KIND: ClassVar[str] = "test_good_block"
    LABEL: ClassVar[str] = "Good"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_CAREGIVER,)
    DEFERRED_FIELDS: ClassVar[tuple[DeferredFieldSpec, ...]] = (
        DeferredFieldSpec(attr="real_field", label="x", kind="text", required=False),
    )

    real_field: str | None = None


class _BadBlock(BaseBlock):
    KIND: ClassVar[str] = "test_bad_block"
    LABEL: ClassVar[str] = "Bad"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_CAREGIVER,)
    DEFERRED_FIELDS: ClassVar[tuple[DeferredFieldSpec, ...]] = (
        DeferredFieldSpec(attr="nonexistent_field", label="x", kind="text", required=False),
    )

    real_field: str | None = None


def test_validate_passes_when_attr_matches_field() -> None:
    validate_deferred_field_attrs(_GoodBlock)


def test_validate_raises_when_attr_unknown() -> None:
    with pytest.raises(DeferredFieldAttrUnknownError) as exc_info:
        validate_deferred_field_attrs(_BadBlock)
    assert exc_info.value.attr == "nonexistent_field"
    assert exc_info.value.block_cls is _BadBlock


def test_validate_all_block_classes_passes() -> None:
    # Catalogue invariant: every shipped subclass declares only attrs that
    # exist as model fields. Surfaces regressions when subclasses move
    # fields to chain slot #2/#3 without updating DEFERRED_FIELDS.
    validate_all_block_classes()
