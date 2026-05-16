from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.errors import AppError


class PathwayNotFoundError(AppError):
    code = "not-found.pathway.unknown"
    status_code = 404
    message = "Pathway not found."


class PathwayVersionNotFoundError(AppError):
    code = "not-found.pathway-version.unknown"
    status_code = 404
    message = "Pathway version not found."


class NoConceptVersionError(AppError):
    code = "no_concept_version"
    status_code = 409
    message = "Pathway has no concept version. Restore or fork-from-publish first."


class ConceptAlreadyExistsError(AppError):
    code = "concept_already_exists"
    status_code = 409
    message = "Pathway already has a concept version."

    def __init__(self, concept_version_id: UUID) -> None:
        super().__init__(
            message=self.message,
            details={"concept_version_id": str(concept_version_id)},
        )


class PathwayVersionImmutableError(AppError):
    code = "pathway_version_immutable"
    status_code = 409
    message = "Published pathway versions are immutable."

    def __init__(self, version_id: UUID) -> None:
        super().__init__(
            message=self.message,
            details={"version_id": str(version_id)},
        )


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


class ForkSourceNotPublishedError(PathwayValidationError):
    code = "invalid.pathway.fork-source"


class PublishApprovalError(PathwayValidationError):
    code = "invalid.pathway.publish-approval"


__all__ = [
    "BlockConfigError",
    "BranchOwnershipError",
    "ConceptAlreadyExistsError",
    "DeferredFieldError",
    "EdgeValidationError",
    "ForkSourceNotPublishedError",
    "NoConceptVersionError",
    "PathwayNotFoundError",
    "PathwayValidationError",
    "PathwayVersionImmutableError",
    "PathwayVersionNotFoundError",
    "PublishApprovalError",
    "TimingValidationError",
    "UnknownBlockTypeError",
    "UnknownLaneKindError",
    "UnknownPhaseError",
]
