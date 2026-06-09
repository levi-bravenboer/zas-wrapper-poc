"""Derived-edge computation from `block.input_logic` (chain slot #2 §3.3).

`pathway_edge` is retired in slot #2 in favour of typed `InputLogic`
rules per block. The canvas keeps drawing one connector per
producer→consumer relationship; this module walks every block's
`input_logic` and yields the equivalent edge list on read.

The shape is intentionally narrow — only what the canvas needs to
render the connector (endpoints, predicate name, args bag for the
edge inspector). Slot #3 runtime never calls this; it consumes the
typed `InputLogic` aggregate directly via the evaluator.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domain.pathway.input_logic.predicates import (
    DecisionOutputArgs,
    HasDataArgs,
    IfDoneArgs,
    InputLogic,
    InputLogicRule,
    PredicateKind,
    ValueEqualsArgs,
    ValueGtArgs,
    WaitAfterArgs,
)


class DerivedEdge(BaseModel):
    """One canvas connector derived from a target block's `input_logic` rule.

    `source_block_id` identifies the producer; for predicates that do
    not name a block (`wait_after` — anchored on a marker, not a
    block), `source_block_id` is `None` and the canvas renders the
    edge as marker-anchored instead.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    target_block_id: UUID
    source_block_id: UUID | None
    predicate: PredicateKind
    args: dict[str, Any] = Field(default_factory=dict)


def derive_edges_from_input_logic(
    target_block_id: UUID, logic: InputLogic
) -> list[DerivedEdge]:
    """Yield one `DerivedEdge` per rule on a block's `input_logic`.

    Pure function — no DB access. The runtime / canvas pipelines are
    expected to invoke it once per block after deserialisation.
    """
    return [_rule_to_derived_edge(target_block_id, rule) for rule in logic.rules]


def _rule_to_derived_edge(target_block_id: UUID, rule: InputLogicRule) -> DerivedEdge:
    args = rule.args
    predicate = args.predicate

    # Each branch maps the typed args back into the wire-friendly
    # `(source_block_id, args_dict)` pair the canvas / edge inspector
    # consume. `model_dump(mode="json")` keeps UUIDs as strings.
    if isinstance(args, IfDoneArgs):
        return DerivedEdge(
            target_block_id=target_block_id,
            source_block_id=args.after_block,
            predicate=predicate,
            args=args.model_dump(mode="json", exclude={"predicate"}),
        )
    if isinstance(args, DecisionOutputArgs):
        return DerivedEdge(
            target_block_id=target_block_id,
            source_block_id=args.after_block,
            predicate=predicate,
            args=args.model_dump(mode="json", exclude={"predicate"}),
        )
    if isinstance(args, (HasDataArgs, ValueEqualsArgs, ValueGtArgs)):
        return DerivedEdge(
            target_block_id=target_block_id,
            source_block_id=args.block,
            predicate=predicate,
            args=args.model_dump(mode="json", exclude={"predicate"}),
        )
    if isinstance(args, WaitAfterArgs):
        return DerivedEdge(
            target_block_id=target_block_id,
            source_block_id=None,
            predicate=predicate,
            args=args.model_dump(mode="json", exclude={"predicate"}),
        )
    raise ValueError(f"unsupported predicate args type: {type(args).__name__}")


__all__ = [
    "DerivedEdge",
    "derive_edges_from_input_logic",
]
