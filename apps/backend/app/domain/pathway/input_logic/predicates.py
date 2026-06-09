"""Predicate vocabulary + `InputLogic` aggregate (chain slot #2 §1).

Each predicate has a closed-enum discriminator (`PredicateKind`) and a
typed `Args` Pydantic model. The discriminated union over `Args`
serialises through the `predicate` field; `InputLogicRule` carries the
producer block reference (`node`) plus the rule itself.

Backfill from the retired `pathway_edge` table (§3):

| Legacy edge timing kind  | Predicate          | Args                                   |
|--------------------------|--------------------|----------------------------------------|
| immediate                | `if_done`          | `{after_block}` (no delay)             |
| completion + delay       | `if_done`          | `{after_block, delay_iso}`             |
| marker + offset          | `wait_after`       | `{marker_id, offset_iso, direction}`   |
| branch                   | `decision_output`  | `{after_block, output_key}`            |

Other predicates (`has_data`, `value_equals`, `value_gt`) author
data-conditioned eligibility on top of the legacy connectivity rules —
new authoring affordances that did not exist in the edge model.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PredicateKind(str, Enum):
    """Closed enum of supported input-logic predicates (D3).

    No expression language. Adding a new predicate is a typed code
    change here + a new `Args` model + an evaluator branch.
    """

    IF_DONE = "if_done"
    HAS_DATA = "has_data"
    VALUE_EQUALS = "value_equals"
    VALUE_GT = "value_gt"
    WAIT_AFTER = "wait_after"
    DECISION_OUTPUT = "decision_output"


# ---- Per-predicate typed args ---------------------------------------------


class _ArgsBase(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class IfDoneArgs(_ArgsBase):
    """Predecessor block has completed (with optional `delay_iso` wait)."""

    predicate: Literal[PredicateKind.IF_DONE] = PredicateKind.IF_DONE
    after_block: UUID
    delay_iso: str | None = None


class HasDataArgs(_ArgsBase):
    """A produced field on `block` is non-null at evaluation time."""

    predicate: Literal[PredicateKind.HAS_DATA] = PredicateKind.HAS_DATA
    block: UUID
    field_path: str


class ValueEqualsArgs(_ArgsBase):
    """A produced field equals `expected`. Pure value compare, no coercion."""

    predicate: Literal[PredicateKind.VALUE_EQUALS] = PredicateKind.VALUE_EQUALS
    block: UUID
    field_path: str
    expected: Any


class ValueGtArgs(_ArgsBase):
    """A produced numeric field is strictly greater than `threshold`."""

    predicate: Literal[PredicateKind.VALUE_GT] = PredicateKind.VALUE_GT
    block: UUID
    field_path: str
    threshold: float


class WaitAfterArgs(_ArgsBase):
    """Anchored wait: marker reached + ISO 8601 offset, direction-signed."""

    predicate: Literal[PredicateKind.WAIT_AFTER] = PredicateKind.WAIT_AFTER
    marker_id: UUID
    offset_iso: str
    direction: Literal["before", "after"]


class DecisionOutputArgs(_ArgsBase):
    """Producer `decision`-class block fired the named `output_key`."""

    predicate: Literal[PredicateKind.DECISION_OUTPUT] = PredicateKind.DECISION_OUTPUT
    after_block: UUID
    output_key: str


PredicateArgs = Annotated[
    Union[
        IfDoneArgs,
        HasDataArgs,
        ValueEqualsArgs,
        ValueGtArgs,
        WaitAfterArgs,
        DecisionOutputArgs,
    ],
    Field(discriminator="predicate"),
]


# ---- Rule + aggregate -----------------------------------------------------


Aggregator = Literal["all_of", "any_of"]


class InputLogicRule(BaseModel):
    """One typed eligibility rule referenced from a downstream block.

    `node` is the producer block reference (uuid string) for
    visualization / canvas wiring; the predicate's typed `args` model
    carries the same id and any predicate-specific fields. Carrying
    `node` at the rule level keeps canvas dispatch O(1) without
    walking into the args union.
    """

    model_config = ConfigDict(extra="forbid", frozen=False)

    node: UUID
    args: PredicateArgs


class InputLogic(BaseModel):
    """Aggregate of rules attached to a `BaseBlock`.

    `aggregator` defines the combinator: `all_of` (default — every rule
    must hold) or `any_of` (at least one). `n_of_m` is an optional
    voting threshold for `any_of`-style gates; when set, the rule list
    must satisfy at least `n` of `m` clauses.
    """

    model_config = ConfigDict(extra="forbid", frozen=False)

    rules: list[InputLogicRule] = []
    aggregator: Aggregator = "all_of"
    n_of_m: tuple[int, int] | None = None


__all__ = [
    "Aggregator",
    "DecisionOutputArgs",
    "HasDataArgs",
    "IfDoneArgs",
    "InputLogic",
    "InputLogicRule",
    "PredicateArgs",
    "PredicateKind",
    "ValueEqualsArgs",
    "ValueGtArgs",
    "WaitAfterArgs",
]
