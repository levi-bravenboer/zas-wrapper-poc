"""Publish-time validators for `BaseBlock` subclasses.

These checks run on the class itself (not instances) so they can be
exercised at import time in tests and at publish time before a pathway
version transitions to `published`. Each validator raises a typed
exception named in `pathway-model-foundations/spec.md`.
"""

from __future__ import annotations

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.decision.typed import DecisionBlock
from app.domain.pathway.blocks.end_pathway.typed import EndPathwayBlock
from app.domain.pathway.blocks.resolver import BLOCK_CLASSES
from app.domain.pathway.blocks.start.typed import StartBlock
from app.domain.pathway.input_logic.predicates import (
    DecisionOutputArgs,
    PredicateKind,
)


class StartBlockCardinalityError(ValueError):
    """Pathway version has 0 or >1 `StartBlock`s (catalogue-expansion § 1).

    Spec invariant: every published pathway version SHALL contain
    exactly one entry block. Surfaces from the publish gate.
    """

    def __init__(self, *, count: int) -> None:
        super().__init__(
            f"pathway version must contain exactly one StartBlock, found {count}"
        )
        self.count = count


class StartBlockShapeError(ValueError):
    """`StartBlock` carries forbidden input_logic / timing_policy.

    Spec invariant: a start block cannot wait on anything (empty
    `input_logic`) and has no timing of its own (`timing_policy=None`).
    Surfaces from the publish gate.
    """

    def __init__(self, *, field: str, reason: str) -> None:
        super().__init__(f"StartBlock.{field}: {reason}")
        self.field = field
        self.reason = reason


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


class LaneKindNotAllowedError(ValueError):
    """Block placed on a lane whose `kind` is not in `allowed_lane_kinds`.

    Class-level invariant per D7. See `pathway-model-foundations/spec.md`
    scenario "Block on disallowed lane rejected". Coexists with the legacy
    `BlockLaneNotAllowedError` raised from the `BlockTypeEntry` catalogue
    check until chain slot #1 §1.4 retires the registry.
    """

    def __init__(
        self,
        block_cls: type[BaseBlock],
        lane_kind_code: str,
        *,
        block_name: str | None = None,
    ) -> None:
        prefix = f"block '{block_name}' ({block_cls.__name__})" if block_name else block_cls.__name__
        super().__init__(
            f"{prefix} placed on lane kind '{lane_kind_code}' which is not in "
            f"allowed_lane_kinds={tuple(block_cls.allowed_lane_kinds)!r}"
        )
        self.block_cls = block_cls
        self.lane_kind_code = lane_kind_code
        self.block_name = block_name


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


def validate_lane_kind(
    block_cls: type[BaseBlock],
    lane_kind_code: str,
    *,
    block_name: str | None = None,
) -> None:
    """Raise `LaneKindNotAllowedError` when `lane_kind_code` is not in
    `block_cls.allowed_lane_kinds` (D7).

    `block_name` is woven into the error message so the builder can
    surface the offending block on the canvas.
    """
    if lane_kind_code not in block_cls.allowed_lane_kinds:
        raise LaneKindNotAllowedError(block_cls, lane_kind_code, block_name=block_name)


def validate_all_block_classes() -> None:
    """Run every class-level validator across the catalogue.

    Used by import-time tests and the publish flow. Stops on the first
    failure; surface all errors by iterating with a try/except in the
    caller if needed.
    """
    for cls in BLOCK_CLASSES:
        validate_deferred_field_attrs(cls)


class BlockPublishValidationError(ValueError):
    """A block instance failed publish-time strict validation.

    Wraps a Pydantic v2 `ValidationError` raised when re-validating the
    block against its typed subclass in strict mode. The publish API
    surfaces this as a 422 keyed on the block id so the builder can
    highlight the offending block on the canvas.
    """

    def __init__(self, block_cls: type[BaseBlock], cause: Exception) -> None:
        super().__init__(
            f"{block_cls.__name__} instance failed strict publish validation: {cause}"
        )
        self.block_cls = block_cls
        self.cause = cause


class DecisionOutputsEmptyError(ValueError):
    """A `DecisionBlock` carries no `outputs` at publish time.

    Slot #2 §5.1 requires every decision block declare at least one
    typed output before publish so downstream `decision_output`
    references resolve.
    """

    def __init__(self, block: BaseBlock) -> None:
        super().__init__(
            f"DecisionBlock '{block.name}' must declare at least one output before publish"
        )
        self.block = block


class DecisionOutputReferenceError(ValueError):
    """A `decision_output` predicate names an unknown `output_key`.

    Slot #2 §5.2 requires every downstream `decision_output` rule
    point at a real (block_id, output_key) pair. Surfaces from
    `validate_decision_output_references`.
    """

    def __init__(
        self,
        *,
        target_block: BaseBlock,
        after_block_id: str,
        output_key: str,
        reason: str,
    ) -> None:
        super().__init__(
            f"decision_output on '{target_block.name}' → "
            f"{after_block_id}.outputs[{output_key!r}]: {reason}"
        )
        self.target_block = target_block
        self.after_block_id = after_block_id
        self.output_key = output_key
        self.reason = reason


def validate_decision_block_outputs(block: BaseBlock) -> None:
    """Reject decision blocks with empty `outputs` (§5.1)."""
    if isinstance(block, DecisionBlock) and not block.outputs:
        raise DecisionOutputsEmptyError(block)


def validate_decision_output_references(
    blocks_by_id: dict[str, BaseBlock],
) -> None:
    """Reject `decision_output` rules pointing at unknown keys (§5.2).

    Walks every block's `input_logic`; for each rule whose predicate
    is `decision_output`, asserts the named producer is a
    `DecisionBlock` and that the `output_key` is in its `outputs`.
    """
    for block in blocks_by_id.values():
        for rule in block.input_logic.rules:
            args = rule.args
            if args.predicate is not PredicateKind.DECISION_OUTPUT:
                continue
            assert isinstance(args, DecisionOutputArgs)
            after_block = blocks_by_id.get(str(args.after_block))
            if after_block is None:
                raise DecisionOutputReferenceError(
                    target_block=block,
                    after_block_id=str(args.after_block),
                    output_key=args.output_key,
                    reason="producer block not in pathway version",
                )
            if not isinstance(after_block, DecisionBlock):
                raise DecisionOutputReferenceError(
                    target_block=block,
                    after_block_id=str(args.after_block),
                    output_key=args.output_key,
                    reason=f"producer is a {type(after_block).__name__}, not a DecisionBlock",
                )
            if args.output_key not in after_block.outputs:
                raise DecisionOutputReferenceError(
                    target_block=block,
                    after_block_id=str(args.after_block),
                    output_key=args.output_key,
                    reason=f"output_key not declared on producer; have {list(after_block.outputs)!r}",
                )


def validate_publish_block(block: BaseBlock) -> None:
    """Re-validate `block` against its subclass in Pydantic v2 strict mode.

    Defends the publish gate per `pathway-model-foundations` §6.1:
    every block instance must satisfy its typed subclass schema before
    a pathway version is allowed to flip to `published`. The strict
    flag disables value coercion (no `"42"` → `42`, no truthy strings
    → bool) so the published row matches the typed columns exactly.
    """
    cls = type(block)
    try:
        cls.model_validate(block.model_dump(), strict=True)
    except Exception as exc:  # pydantic.ValidationError + subclasses
        raise BlockPublishValidationError(cls, exc) from exc


class EndPathwayBlockMissingError(ValueError):
    """Pathway version has zero `EndPathwayBlock`s (catalogue-expansion § 2).

    Spec invariant: every published pathway version SHALL contain at
    least one terminal block so the runtime has a defined completion
    surface. Surfaces from the publish gate.
    """

    def __init__(self) -> None:
        super().__init__(
            "pathway version must contain at least one EndPathwayBlock"
        )


class EndPathwayBlockShapeError(ValueError):
    """`EndPathwayBlock` carries a forbidden `timing_policy`.

    Spec invariant: a terminal block fires immediately once eligible —
    `timing_policy` MUST be `None`. `input_logic` IS allowed (and
    typically required) to gate which branch leads to which terminal.
    Surfaces from the publish gate.
    """

    def __init__(self, *, reason: str) -> None:
        super().__init__(f"EndPathwayBlock.timing_policy: {reason}")
        self.field = "timing_policy"
        self.reason = reason


def validate_end_pathway_block_invariants(blocks: dict[str, BaseBlock]) -> None:
    """Enforce EndPathwayBlock cardinality + shape across a pathway version.

    Catalogue-expansion § 2:

    1. At least one `EndPathwayBlock` per version. Multiple are allowed —
       each terminal branch carries its own end.
    2. Every `EndPathwayBlock.timing_policy` must be `None`. `input_logic`
       is unrestricted; the publish gate trusts the upstream graph
       validator to ensure each end is reachable.
    """

    ends = [b for b in blocks.values() if isinstance(b, EndPathwayBlock)]
    if not ends:
        raise EndPathwayBlockMissingError()

    for end in ends:
        if end.timing_policy is not None:
            raise EndPathwayBlockShapeError(
                reason="EndPathwayBlock fires on eligibility — timing_policy must be None",
            )


def validate_start_block_invariants(blocks: dict[str, BaseBlock]) -> None:
    """Enforce StartBlock cardinality + shape across a pathway version.

    Catalogue-expansion § 1:

    1. Exactly one `StartBlock` per version (publish-time invariant —
       no 0 / >1).
    2. The start's `input_logic` must be the empty aggregate (it has
       no upstream).
    3. The start's `timing_policy` must be `None` (it fires at t=0).
    """

    starts = [b for b in blocks.values() if isinstance(b, StartBlock)]
    if len(starts) != 1:
        raise StartBlockCardinalityError(count=len(starts))

    start = starts[0]
    if start.input_logic.rules:
        raise StartBlockShapeError(
            field="input_logic",
            reason="StartBlock cannot wait on upstream blocks — input_logic must be empty",
        )
    if start.timing_policy is not None:
        raise StartBlockShapeError(
            field="timing_policy",
            reason="StartBlock fires at enrollment t=0 — timing_policy must be None",
        )


__all__ = [
    "BlockPublishValidationError",
    "DecisionOutputReferenceError",
    "DecisionOutputsEmptyError",
    "DeferredFieldAttrUnknownError",
    "EndPathwayBlockMissingError",
    "EndPathwayBlockShapeError",
    "LaneKindNotAllowedError",
    "StartBlockCardinalityError",
    "StartBlockShapeError",
    "validate_all_block_classes",
    "validate_decision_block_outputs",
    "validate_decision_output_references",
    "validate_deferred_field_attrs",
    "validate_end_pathway_block_invariants",
    "validate_lane_kind",
    "validate_publish_block",
    "validate_start_block_invariants",
]
