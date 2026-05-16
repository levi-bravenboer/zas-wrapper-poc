from __future__ import annotations

from typing import Any

from app.core.errors import AppError


class PathwayNotFoundError(AppError):
    code = "not-found.pathway.unknown"
    status_code = 404
    message = "Pathway not found."


class PathwayValidationError(AppError):
    code = "invalid.pathway.definition"
    status_code = 422
    message = "Pathway definition failed validation."

    def __init__(self, *, field: str, reason: str, extra: dict[str, Any] | None = None) -> None:
        details: dict[str, Any] = {"field": field, "reason": reason}
        if extra:
            details.update(extra)
        super().__init__(message=f"{field}: {reason}", details=details)


class UnknownBlockTypeError(PathwayValidationError):
    code = "invalid.pathway.block-type"


class UnknownLaneKindError(PathwayValidationError):
    code = "invalid.pathway.lane-kind"


class UnknownPhaseError(PathwayValidationError):
    code = "invalid.pathway.phase"


class TimingValidationError(PathwayValidationError):
    code = "invalid.pathway.timing"


class BranchOwnershipError(PathwayValidationError):
    code = "invalid.pathway.branch"


class EdgeValidationError(PathwayValidationError):
    code = "invalid.pathway.edge"


class DeferredFieldError(PathwayValidationError):
    code = "invalid.pathway.deferred-field"


class BlockConfigError(PathwayValidationError):
    code = "invalid.pathway.block-config"


__all__ = [
    "BlockConfigError",
    "BranchOwnershipError",
    "DeferredFieldError",
    "EdgeValidationError",
    "PathwayNotFoundError",
    "PathwayValidationError",
    "TimingValidationError",
    "UnknownBlockTypeError",
    "UnknownLaneKindError",
    "UnknownPhaseError",
]
