"""Pathway runtime aggregate domain (chain slot #3).

Houses the typed runtime models (`PathwayEnrollment`, `BlockExecution`,
`DeferredFieldValue`) and the state-machine transitions consumed by
the runtime engine. Template-side state remains in
`app/domain/pathway/blocks/*` and the schemas layer.
"""

from app.domain.pathway.runtime.deferred_value import DeferredFieldValue
from app.domain.pathway.runtime.enrollment import (
    EnrollmentState,
    PathwayEnrollment,
)
from app.domain.pathway.runtime.execution import (
    BlockExecution,
    BlockExecutionState,
    InvalidTransitionError,
)


__all__ = [
    "BlockExecution",
    "BlockExecutionState",
    "DeferredFieldValue",
    "EnrollmentState",
    "InvalidTransitionError",
    "PathwayEnrollment",
]
