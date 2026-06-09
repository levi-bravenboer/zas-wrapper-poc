"""Pathway input-logic domain.

Closed-enum predicate vocabulary that replaces the authored
`pathway_edge` table per `pathway-input-logic-and-timing` §1 / §3 (D2 +
D3). Each predicate carries typed args; the discriminated union is
authoritative both on the wire (autosave / publish payload) and in the
runtime evaluator (slot #3).

MDR posture: every predicate is operational. None encode clinical
reasoning. Adding a new predicate is a typed code change + review, not a
runtime configuration knob.
"""

from app.domain.pathway.input_logic.predicates import (
    Aggregator,
    DecisionOutputArgs,
    HasDataArgs,
    IfDoneArgs,
    InputLogic,
    InputLogicRule,
    PredicateArgs,
    PredicateKind,
    ValueEqualsArgs,
    ValueGtArgs,
    WaitAfterArgs,
)


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
