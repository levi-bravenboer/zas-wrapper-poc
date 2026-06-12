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
from app.domain.pathway.blocks.appointment.typed import AppointmentBlock
from app.domain.pathway.blocks.task.typed import TaskBlock
from app.domain.pathway.blocks.decision.typed import DecisionBlock
from app.domain.pathway.blocks.end_pathway.typed import EndPathwayBlock
from app.domain.pathway.blocks.pathway_link.typed import PathwayLinkBlock
from app.domain.pathway.blocks.start.typed import StartBlock
from app.domain.pathway.blocks.validators import (
    DecisionOutputReferenceError,
    DeferredFieldAttrUnknownError,
    EndPathwayBlockMissingError,
    EndPathwayBlockShapeError,
    IfNotDoneWithinRuleError,
    LaneKindNotAllowedError,
    StartBlockCardinalityError,
    StartBlockShapeError,
    validate_all_block_classes,
    validate_decision_output_references,
    validate_deferred_field_attrs,
    validate_end_pathway_block_invariants,
    validate_if_not_done_within_rules,
    validate_lane_kind,
    validate_start_block_invariants,
)
from app.domain.pathway.input_logic import (
    DecisionOutputArgs,
    IfDoneArgs,
    IfNotDoneWithinArgs,
    InputLogic,
    InputLogicRule,
)
from app.domain.pathway.lanes import (
    LANE_KIND_CAREGIVER,
    LANE_KIND_EXTERNAL,
    LANE_KIND_PATIENT,
)
from app.domain.pathway.timing import WaitAfterPolicy
from uuid import uuid4


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


# ---- Lane-kind invariant (D7) -----------------------------------------


def test_validate_lane_kind_passes_for_allowed_kind() -> None:
    # AppointmentBlock.allowed_lane_kinds = (LANE_KIND_CAREGIVER,)
    validate_lane_kind(AppointmentBlock, LANE_KIND_CAREGIVER)


def test_validate_lane_kind_rejects_disallowed_kind() -> None:
    # AppointmentBlock disallowed on patient + external lanes.
    with pytest.raises(LaneKindNotAllowedError) as exc_info:
        validate_lane_kind(
            AppointmentBlock,
            LANE_KIND_EXTERNAL,
            block_name="Intake",
        )
    assert exc_info.value.block_cls is AppointmentBlock
    assert exc_info.value.lane_kind_code == LANE_KIND_EXTERNAL
    assert exc_info.value.block_name == "Intake"


def test_validate_lane_kind_multi_kind_subclass() -> None:
    # TaskBlock allows patient or caregiver lanes; both pass.
    validate_lane_kind(TaskBlock, LANE_KIND_PATIENT)
    validate_lane_kind(TaskBlock, LANE_KIND_CAREGIVER)
    with pytest.raises(LaneKindNotAllowedError):
        validate_lane_kind(TaskBlock, LANE_KIND_EXTERNAL)


# ---- StartBlock invariants (catalogue-expansion § 1) -------------------


def test_start_invariants_pass_for_lone_clean_start() -> None:
    start = StartBlock(name="Start")
    other = AppointmentBlock(name="Intake", title="Intake")
    blocks: dict[str, BaseBlock] = {str(uuid4()): start, str(uuid4()): other}
    validate_start_block_invariants(blocks)


def test_start_invariants_reject_zero_starts() -> None:
    blocks: dict[str, BaseBlock] = {
        str(uuid4()): AppointmentBlock(name="Intake", title="Intake")
    }
    with pytest.raises(StartBlockCardinalityError) as exc_info:
        validate_start_block_invariants(blocks)
    assert exc_info.value.count == 0


def test_start_invariants_reject_two_starts() -> None:
    blocks: dict[str, BaseBlock] = {
        str(uuid4()): StartBlock(name="Start A"),
        str(uuid4()): StartBlock(name="Start B"),
    }
    with pytest.raises(StartBlockCardinalityError) as exc_info:
        validate_start_block_invariants(blocks)
    assert exc_info.value.count == 2


def test_start_invariants_reject_non_empty_input_logic() -> None:
    upstream_id = uuid4()
    start = StartBlock(
        name="Start",
        input_logic=InputLogic(
            rules=[InputLogicRule(node=upstream_id, args=IfDoneArgs(after_block=upstream_id))],
        ),
    )
    blocks: dict[str, BaseBlock] = {str(uuid4()): start}
    with pytest.raises(StartBlockShapeError) as exc_info:
        validate_start_block_invariants(blocks)
    assert exc_info.value.field == "input_logic"


def test_start_invariants_reject_timing_policy() -> None:
    start = StartBlock(name="Start", timing_policy=WaitAfterPolicy(offset_iso="PT5M"))
    blocks: dict[str, BaseBlock] = {str(uuid4()): start}
    with pytest.raises(StartBlockShapeError) as exc_info:
        validate_start_block_invariants(blocks)
    assert exc_info.value.field == "timing_policy"


# ---- EndPathwayBlock invariants (catalogue-expansion § 2) --------------


def test_end_invariants_pass_for_single_end() -> None:
    end = EndPathwayBlock(name="End")
    blocks: dict[str, BaseBlock] = {str(uuid4()): end}
    validate_end_pathway_block_invariants(blocks)


def test_end_invariants_pass_for_multiple_ends() -> None:
    blocks: dict[str, BaseBlock] = {
        str(uuid4()): EndPathwayBlock(name="End A"),
        str(uuid4()): EndPathwayBlock(name="End B"),
    }
    validate_end_pathway_block_invariants(blocks)


def test_end_invariants_reject_zero_ends() -> None:
    blocks: dict[str, BaseBlock] = {
        str(uuid4()): AppointmentBlock(name="Intake", title="Intake"),
    }
    with pytest.raises(EndPathwayBlockMissingError):
        validate_end_pathway_block_invariants(blocks)


def test_end_invariants_reject_timing_policy() -> None:
    end = EndPathwayBlock(name="End", timing_policy=WaitAfterPolicy(offset_iso="PT1M"))
    blocks: dict[str, BaseBlock] = {str(uuid4()): end}
    with pytest.raises(EndPathwayBlockShapeError) as exc_info:
        validate_end_pathway_block_invariants(blocks)
    assert exc_info.value.field == "timing_policy"


def test_end_invariants_allow_input_logic() -> None:
    upstream_id = uuid4()
    end = EndPathwayBlock(
        name="End",
        input_logic=InputLogic(
            rules=[InputLogicRule(node=upstream_id, args=IfDoneArgs(after_block=upstream_id))],
        ),
    )
    blocks: dict[str, BaseBlock] = {str(uuid4()): end}
    validate_end_pathway_block_invariants(blocks)


# ---- PathwayLinkBlock business-logic gaps (catalogue-expansion § A5) ----


def test_decision_output_reference_against_pathway_link_rejected() -> None:
    """§ A5.3 — decision_output rules MUST NOT target a PathwayLinkBlock.

    Sub-pathways do not have authored decision outputs; only
    `if_done(pathway_link)` is a valid upstream reference. The
    existing `validate_decision_output_references` enforces this
    via the "producer is a {type}, not a DecisionBlock" branch.
    """
    link_id_uuid = uuid4()
    link_block = PathwayLinkBlock(
        name="Biopsy subpath",
        target_pathway_id=link_id_uuid,
        mode="blocking",
    )
    downstream = AppointmentBlock(
        name="Pathology review",
        title="Pathology review",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(
                    node=link_id_uuid,
                    args=DecisionOutputArgs(
                        after_block=link_id_uuid,
                        output_key="completed",
                    ),
                ),
            ],
        ),
    )
    blocks: dict[str, BaseBlock] = {
        str(link_id_uuid): link_block,
        str(uuid4()): downstream,
    }
    with pytest.raises(DecisionOutputReferenceError) as exc_info:
        validate_decision_output_references(blocks)
    assert "PathwayLinkBlock" in exc_info.value.reason
    assert "DecisionBlock" in exc_info.value.reason


def test_decision_output_reference_against_decision_block_accepted() -> None:
    decision_id_uuid = uuid4()
    decision = DecisionBlock(
        name="Voortgangsmeting",
        question="Verloopt het herstel?",
        outputs=("goed", "onvoldoende"),
    )
    downstream = AppointmentBlock(
        name="Extra controle",
        title="Extra controle",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(
                    node=decision_id_uuid,
                    args=DecisionOutputArgs(
                        after_block=decision_id_uuid,
                        output_key="onvoldoende",
                    ),
                ),
            ],
        ),
    )
    blocks: dict[str, BaseBlock] = {
        str(decision_id_uuid): decision,
        str(uuid4()): downstream,
    }
    validate_decision_output_references(blocks)


# ---- if_not_done_within publish gate (pathway-completion § B1.5) --------


def test_if_not_done_within_valid_rule_passes() -> None:
    upstream_id = uuid4()
    upstream = AppointmentBlock(name="Pathologie", title="Pathologie")
    downstream = AppointmentBlock(
        name="Escalatie",
        title="Escalatie",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(
                    node=upstream_id,
                    args=IfNotDoneWithinArgs(
                        after_block=upstream_id, offset_iso="P14D"
                    ),
                ),
            ],
        ),
    )
    blocks: dict[str, BaseBlock] = {
        str(upstream_id): upstream,
        str(uuid4()): downstream,
    }
    validate_if_not_done_within_rules(blocks)


def test_if_not_done_within_unknown_reference_rejected() -> None:
    ghost_id = uuid4()
    downstream = AppointmentBlock(
        name="Escalatie",
        title="Escalatie",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(
                    node=ghost_id,
                    args=IfNotDoneWithinArgs(
                        after_block=ghost_id, offset_iso="P14D"
                    ),
                ),
            ],
        ),
    )
    blocks: dict[str, BaseBlock] = {str(uuid4()): downstream}
    with pytest.raises(IfNotDoneWithinRuleError) as exc_info:
        validate_if_not_done_within_rules(blocks)
    assert "not in pathway version" in exc_info.value.reason


def test_if_not_done_within_invalid_iso_rejected() -> None:
    upstream_id = uuid4()
    upstream = AppointmentBlock(name="Pathologie", title="Pathologie")
    downstream = AppointmentBlock(
        name="Escalatie",
        title="Escalatie",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(
                    node=upstream_id,
                    args=IfNotDoneWithinArgs(
                        after_block=upstream_id, offset_iso="veertien dagen"
                    ),
                ),
            ],
        ),
    )
    blocks: dict[str, BaseBlock] = {
        str(upstream_id): upstream,
        str(uuid4()): downstream,
    }
    with pytest.raises(IfNotDoneWithinRuleError) as exc_info:
        validate_if_not_done_within_rules(blocks)
    assert "offset_iso invalid" in exc_info.value.reason
