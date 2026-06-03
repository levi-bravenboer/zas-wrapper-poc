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


class EdgeTimingValidationError(PathwayValidationError):
    code = "invalid.pathway.edge-timing"

    def __init__(self, *, edge_id: UUID, reason: str) -> None:
        super().__init__(
            field=f"edges[{edge_id}].timing",
            reason=reason,
            extra={"edge_id": str(edge_id)},
        )


class DeferredFieldError(PathwayValidationError):
    code = "invalid.pathway.deferred-field"


class BlockConfigError(PathwayValidationError):
    code = "invalid.pathway.block-config"


class PathwayHasReferrersError(AppError):
    """Raised when deleting a pathway that is still referenced as a
    sub-pathway by one or more other pathways. The error payload carries
    the list of referring pathway ids + names so the UI can render a clear
    explanation in the delete-confirmation modal.
    """

    code = "conflict.pathway.has-referrers"
    status_code = 409
    message = "Pathway is used as a sub-pathway by other pathways."

    def __init__(self, *, referrers: list[dict[str, str]]) -> None:
        super().__init__(message=self.message, details={"referrers": referrers})


class NestedPathwayCycleError(PathwayValidationError):
    code = "invalid.pathway.nested-cycle"

    def __init__(
        self,
        *,
        block_id: UUID,
        parent_pathway_id: UUID,
        target_pathway_id: UUID,
        kind: str,
    ) -> None:
        # `kind` is `"self"` for direct self-links and `"ancestor"` for indirect
        # cycles through the parent chain. Surfaced in the error payload so the
        # builder can render a precise inline message.
        super().__init__(
            field=f"blocks[{block_id}].config.target_pathway_id",
            reason=(
                "pathway_link would create a cycle: target appears in "
                "the parent pathway's ancestor chain"
                if kind == "ancestor"
                else "pathway_link cannot target its own pathway"
            ),
            extra={
                "block_id": str(block_id),
                "parent_pathway_id": str(parent_pathway_id),
                "target_pathway_id": str(target_pathway_id),
                "cycle_kind": kind,
            },
        )


class BlockLaneNotAllowedError(PathwayValidationError):
    code = "invalid.pathway.block-lane"

    def __init__(
        self,
        *,
        block_id: UUID,
        block_type: str,
        lane_kind_code: str,
        allowed: tuple[str, ...] | list[str],
    ) -> None:
        super().__init__(
            field=f"blocks[{block_id}].lane_id",
            reason=(
                f"block type '{block_type}' cannot be placed on lane kind "
                f"'{lane_kind_code}' (allowed: {sorted(allowed)})"
            ),
            extra={
                "block_id": str(block_id),
                "block_type": block_type,
                "lane_kind_code": lane_kind_code,
                "allowed_lane_kind_codes": list(allowed),
            },
        )


class ForkSourceNotPublishedError(PathwayValidationError):
    code = "invalid.pathway.fork-source"


class PublishApprovalError(PathwayValidationError):
    code = "invalid.pathway.publish-approval"


__all__ = [
    "BlockConfigError",
    "BlockLaneNotAllowedError",
    "BranchOwnershipError",
    "ConceptAlreadyExistsError",
    "DeferredFieldError",
    "EdgeTimingValidationError",
    "EdgeValidationError",
    "ForkSourceNotPublishedError",
    "NestedPathwayCycleError",
    "NoConceptVersionError",
    "PathwayHasReferrersError",
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
