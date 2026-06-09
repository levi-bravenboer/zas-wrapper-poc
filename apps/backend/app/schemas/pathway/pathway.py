from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

# `PathwayTypedBlockOut` is the discriminated-union response shape for
# pathway blocks (chain slot #1 §4.1). Imported as a forward reference
# to avoid a circular import: `typed_blocks` depends on the per-kind
# domain `BaseBlock` subclasses which transitively re-enter the
# `app.schemas.pathway` package via `_base.py`'s import of the small
# `Literal` types. `app/schemas/pathway/__init__.py` calls
# `PathwayVersionDefinition.model_rebuild()` after the typed_blocks
# module has loaded to resolve the forward ref.
if TYPE_CHECKING:
    from app.schemas.pathway.typed_blocks import PathwayTypedBlockOut


class PathwayCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    clinical_goal: str = Field(min_length=1)
    patient_goal: str = Field(min_length=1)


class PathwaySummary(BaseModel):
    """Overview row for `GET /pathways`. Rollups derived per `pathway-version`
    Requirement 11 — backend joins `pathway_version` + `pathway_block`, never
    reads denormalised columns on `pathway`.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    clinical_goal: str | None = None
    patient_goal: str | None = None
    updated_at: datetime
    block_count: int
    last_edited_at: datetime
    has_concept: bool
    concept_version_id: UUID | None = None
    latest_published_version_id: UUID | None = None
    latest_published_version_no: int | None = None
    latest_published_at: datetime | None = None


class PathwayParentReference(BaseModel):
    """Minimal identifier returned by `GET /pathways/{id}/parent-references`.
    Drives the delete-confirmation modal: when this list is non-empty the
    target pathway is used as a sub-pathway by another pathway and may not
    be deleted until those references are removed.
    """

    id: UUID
    name: str


class PathwayChildSummary(BaseModel):
    """Minimal summary returned by `GET /pathways/{id}/summary` — drives the
    read-only child preview rendered inside a parent pathway's nested-pathway
    inspector. `lane_count` / `block_count` come from the pathway's preferred
    version (latest published if it exists; otherwise the concept version)
    so the inspector reflects what a parent would actually link to.
    """

    id: UUID
    name: str
    lane_count: int
    block_count: int
    latest_published_version_id: UUID | None = None


# Aggregate child shapes — client supplies stable UUIDs so cross-child
# references (block → phase / lane, edge → block, etc.) wire in one payload.
# `Out` variants are returned as-is from `GET /pathways/{id}`; `In` variants
# are accepted on `PUT /pathways/{id}`.


_FIXED: Literal["fixed"] = "fixed"
_ENROLLMENT: Literal["enrollment"] = "enrollment"


class PathwayTimingValueIn(BaseModel):
    id: UUID
    kind: Literal["fixed", "enrollment"]
    fixed_days: int | None = Field(default=None, ge=0)
    enrollment_default_days: int | None = Field(default=None, ge=0)
    enrollment_min_days: int | None = Field(default=None, ge=0)
    enrollment_max_days: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_kind_columns(self) -> PathwayTimingValueIn:
        if self.kind == _FIXED:
            if self.fixed_days is None:
                raise ValueError("timing kind 'fixed' requires fixed_days")
            if (
                self.enrollment_default_days is not None
                or self.enrollment_min_days is not None
                or self.enrollment_max_days is not None
            ):
                raise ValueError("timing kind 'fixed' must not set enrollment_* columns")
        elif self.kind == _ENROLLMENT:
            if self.enrollment_default_days is None:
                raise ValueError("timing kind 'enrollment' requires enrollment_default_days")
            if self.fixed_days is not None:
                raise ValueError("timing kind 'enrollment' must not set fixed_days")
            if (
                self.enrollment_min_days is not None
                and self.enrollment_max_days is not None
                and self.enrollment_min_days > self.enrollment_max_days
            ):
                raise ValueError("enrollment_min_days must be <= enrollment_max_days")
        return self


class PathwayTimingValueOut(PathwayTimingValueIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayPhaseIn(BaseModel):
    id: UUID
    template_id: str | None = Field(default=None, max_length=63)
    label: str = Field(min_length=1, max_length=255)
    ord: int = Field(ge=0)
    width_px: int = Field(default=380, ge=1)


class PathwayPhaseOut(PathwayPhaseIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayLaneIn(BaseModel):
    id: UUID
    lane_kind_code: str = Field(
        min_length=1,
        max_length=63,
        description="System lane-kind code (resolves to pathway_lane_kind.id server-side)",
    )
    label: str = Field(min_length=1, max_length=255)
    ord: int = Field(ge=0)
    is_default: bool = False
    height_px: int = Field(default=180, ge=1)


class PathwayLaneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pathway_lane_kind_id: UUID
    lane_kind_code: str
    label: str
    ord: int
    is_default: bool
    height_px: int


class PathwayBlockIn(BaseModel):
    id: UUID
    phase_id: UUID
    lane_id: UUID | None = Field(
        default=None,
        description=(
            "Optional. When omitted the backend materializes the block type's "
            "default lane (catalogue.allowed_lane_kind_codes[0])."
        ),
    )
    type: str = Field(min_length=1, max_length=63)
    label: str | None = Field(default=None, max_length=255)
    duration_value_id: UUID | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    x: int = 0
    y: int = 0


class PathwayBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phase_id: UUID
    lane_id: UUID
    type: str
    label: str | None = None
    duration_value_id: UUID | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    x: int = 0
    y: int = 0


class PathwayBlockBranchIn(BaseModel):
    id: UUID
    block_id: UUID
    label: str = Field(min_length=1, max_length=255)
    ord: int = Field(ge=0)


class PathwayBlockBranchOut(PathwayBlockBranchIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayEdgeIn(BaseModel):
    id: UUID
    source_block_id: UUID
    target_block_id: UUID
    source_branch_id: UUID | None = None
    delay_value_id: UUID | None = None
    # Marker-anchored timing: all three must be set together or all null.
    # Cross-kind invariant (`completion XOR marker XOR branch XOR immediate`)
    # is enforced in the service layer + a Postgres CHECK constraint.
    time_marker_id: UUID | None = None
    offset_value_id: UUID | None = None
    offset_direction_code: str | None = Field(default=None, max_length=63)


class PathwayEdgeOut(PathwayEdgeIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayTimeMarkerIn(BaseModel):
    id: UUID
    value_id: UUID
    label: str = Field(min_length=1, max_length=255)


class PathwayTimeMarkerOut(PathwayTimeMarkerIn):
    model_config = ConfigDict(from_attributes=True)


class PathwayBlockDeferredFieldIn(BaseModel):
    id: UUID
    block_id: UUID
    field_path: str = Field(min_length=1, max_length=255)


class PathwayBlockDeferredFieldOut(PathwayBlockDeferredFieldIn):
    model_config = ConfigDict(from_attributes=True)


# ----- Identity + version meta ------------------------------------------


VersionStatus = Literal["concept", "published", "archived"]
VersionKind = Literal["initial", "fork-from-publish", "restore-from-version"]


class PathwayBare(BaseModel):
    """Identity fields only — no version-scoped children. Returned as the
    `pathway` arm of `PathwayWithVersionResponse`.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    clinical_goal: str | None = None
    patient_goal: str | None = None
    updated_at: datetime


class PathwayActorRef(BaseModel):
    """Minimal user reference embedded in version summaries."""

    id: UUID
    name: str | None = None


class PathwayVersionSummary(BaseModel):
    """One row of `GET /pathways/{id}/versions` (reverse-chrono)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pathway_id: UUID
    version_no: int
    status: VersionStatus
    kind: VersionKind
    label: str | None = None
    note: str | None = None
    derived_from_version_id: UUID | None = None
    created_at: datetime
    created_by: PathwayActorRef | None = None
    published_at: datetime | None = None
    published_by: PathwayActorRef | None = None


class PathwayVersionDefinition(BaseModel):
    """Snapshot of one pathway version — meta + children. Returned by version
    detail endpoints and embedded as `version` in `PathwayWithVersionResponse`.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pathway_id: UUID
    version_no: int
    status: VersionStatus
    kind: VersionKind
    label: str | None = None
    note: str | None = None
    derived_from_version_id: UUID | None = None
    published_at: datetime | None = None
    published_by: UUID | None = None
    updated_at: datetime
    phases: list[PathwayPhaseOut] = Field(default_factory=list)
    lanes: list[PathwayLaneOut] = Field(default_factory=list)
    timing_values: list[PathwayTimingValueOut] = Field(default_factory=list)
    blocks: list["PathwayTypedBlockOut"] = Field(default_factory=list)
    branches: list[PathwayBlockBranchOut] = Field(default_factory=list)
    edges: list[PathwayEdgeOut] = Field(default_factory=list)
    time_markers: list[PathwayTimeMarkerOut] = Field(default_factory=list)
    deferred_fields: list[PathwayBlockDeferredFieldOut] = Field(default_factory=list)


class PathwayWithVersionResponse(BaseModel):
    """Resolved-version envelope for `GET /pathways/{id}` and `POST /pathways`.

    `version` is the current concept if one exists, else the latest published
    (per `pathway-version` spec Requirement 9).
    """

    pathway: PathwayBare
    version: PathwayVersionDefinition


class PathwayDefinitionReplace(BaseModel):
    """Autosave body for `PUT /pathways/{id}` — applied to the current concept
    version's children. Pathway identity fields (`name`/`clinical_goal`/
    `patient_goal`) live on the pathway row and are mutable regardless of
    version status.
    """

    name: str = Field(min_length=1, max_length=255)
    clinical_goal: str | None = Field(default=None)
    patient_goal: str | None = Field(default=None)
    phases: list[PathwayPhaseIn] = Field(default_factory=list)
    lanes: list[PathwayLaneIn] = Field(default_factory=list)
    timing_values: list[PathwayTimingValueIn] = Field(default_factory=list)
    blocks: list[PathwayBlockIn] = Field(default_factory=list)
    branches: list[PathwayBlockBranchIn] = Field(default_factory=list)
    edges: list[PathwayEdgeIn] = Field(default_factory=list)
    time_markers: list[PathwayTimeMarkerIn] = Field(default_factory=list)
    deferred_fields: list[PathwayBlockDeferredFieldIn] = Field(default_factory=list)


class PathwayDuplicateRequest(BaseModel):
    source_version_id: UUID


class PathwayPublishRequest(BaseModel):
    """Body for `POST /pathways/{id}/publish` — promotes the current concept.
    `clinically_approved` is `Literal[True]`: anything else is a 422 from the
    framework rather than a custom validator (keeps the error payload JSON-
    serialisable without bespoke handling).
    """

    label: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=2000)
    clinically_approved: Literal[True] = Field(
        description="Must be true. The frontend gates this behind an explicit checkbox.",
    )
