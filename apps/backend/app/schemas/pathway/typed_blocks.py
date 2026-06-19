"""Discriminated-union response shape for pathway blocks (chain slot #1).

`GET /pathways/{id}` and `GET /pathways/{id}/blocks/{block_id}` serialise
blocks via a Pydantic v2 discriminated union keyed on `kind`, per
`pathway-model-foundations` §4.1 / §4.2.

Each per-kind member is built by multi-inheriting the domain
`BaseBlock` subclass (source of truth for typed instance fields +
shared `name` / `input_logic` / `timing_policy` stubs) with
`_BlockEnvelopeFields` (row-level identity / placement). Each member
adds an instance-level `kind: Literal[...]` field used as the
Pydantic discriminator. Legacy `type` / `config` columns are NOT
surfaced — the frontend dispatches on `kind` and reads typed fields
directly. Writes still accept the legacy shape via the
`block_write_shim` (§5.1); the symmetric typed write payload is
accepted via `X-Pathway-Block-Shape: typed` (§5.2).
"""

from __future__ import annotations

from typing import Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domain.pathway.blocks.appointment.typed import AppointmentBlock
from app.domain.pathway.blocks.decision.typed import DecisionBlock
from app.domain.pathway.blocks.end_pathway.typed import EndPathwayBlock
from app.domain.pathway.blocks.form.typed import FormBlock
from app.domain.pathway.blocks.informed_consent.typed import InformedConsentBlock
from app.domain.pathway.blocks.luscii_program.typed import ExternalProgramBlock
from app.domain.pathway.blocks.mdo.typed import MdoBlock
from app.domain.pathway.blocks.message.typed import MessageBlock
from app.domain.pathway.blocks.pathway_link.typed import PathwayLinkBlock
from app.domain.pathway.blocks.start.typed import StartBlock
from app.domain.pathway.blocks.task.typed import TaskBlock
from app.domain.pathway.blocks.treatment.typed import TreatmentBlock


class _BlockEnvelopeFields(BaseModel):
    """Row-level identity / placement fields shared by every typed block out.

    Slot #2 §6 retired the legacy `type` / `config` / `label` compat
    fields — the typed write surface is now authoritative on both
    sides of the wire. The `kind` discriminator carries the
    information `type` used to (with the legacy alias map living in
    `resolver._LEGACY_TYPE_ALIASES` for storage-layer migration only).
    """

    model_config = ConfigDict(extra="forbid")

    id: UUID
    phase_id: UUID
    lane_id: UUID
    duration_value_id: UUID | None = None
    x: int = 0
    y: int = 0


class StartBlockOut(StartBlock, _BlockEnvelopeFields):
    kind: Literal["start"] = "start"


class AppointmentBlockOut(AppointmentBlock, _BlockEnvelopeFields):
    kind: Literal["appointment"] = "appointment"


class TreatmentBlockOut(TreatmentBlock, _BlockEnvelopeFields):
    kind: Literal["treatment"] = "treatment"


class TaskBlockOut(TaskBlock, _BlockEnvelopeFields):
    kind: Literal["task"] = "task"


class DecisionBlockOut(DecisionBlock, _BlockEnvelopeFields):
    kind: Literal["decision"] = "decision"


class MessageBlockOut(MessageBlock, _BlockEnvelopeFields):
    kind: Literal["message"] = "message"


class InformedConsentBlockOut(InformedConsentBlock, _BlockEnvelopeFields):
    kind: Literal["informed_consent"] = "informed_consent"


class MdoBlockOut(MdoBlock, _BlockEnvelopeFields):
    kind: Literal["mdo"] = "mdo"


class FormBlockOut(FormBlock, _BlockEnvelopeFields):
    kind: Literal["form"] = "form"


class PathwayLinkBlockOut(PathwayLinkBlock, _BlockEnvelopeFields):
    kind: Literal["pathway_link"] = "pathway_link"


class ExternalProgramBlockOut(ExternalProgramBlock, _BlockEnvelopeFields):
    kind: Literal["external_program"] = "external_program"


class EndPathwayBlockOut(EndPathwayBlock, _BlockEnvelopeFields):
    kind: Literal["end_pathway"] = "end_pathway"


PathwayTypedBlockOut = Annotated[
    Union[
        StartBlockOut,
        AppointmentBlockOut,
        TreatmentBlockOut,
        TaskBlockOut,
        DecisionBlockOut,
        MessageBlockOut,
        InformedConsentBlockOut,
        MdoBlockOut,
        FormBlockOut,
        PathwayLinkBlockOut,
        ExternalProgramBlockOut,
        EndPathwayBlockOut,
    ],
    Field(discriminator="kind"),
]


_OUT_BY_KIND: dict[str, type[BaseModel]] = {
    "start": StartBlockOut,
    "appointment": AppointmentBlockOut,
    "treatment": TreatmentBlockOut,
    "task": TaskBlockOut,
    "decision": DecisionBlockOut,
    "message": MessageBlockOut,
    "informed_consent": InformedConsentBlockOut,
    "mdo": MdoBlockOut,
    "form": FormBlockOut,
    "pathway_link": PathwayLinkBlockOut,
    "external_program": ExternalProgramBlockOut,
    "end_pathway": EndPathwayBlockOut,
}


def out_class_for_kind(kind: str) -> type[BaseModel]:
    """Return the `*BlockOut` class for a discriminator value."""
    return _OUT_BY_KIND[kind]


# ---- Typed write surface (slot #2 §6) ------------------------------------
#
# Mirrors the read union for symmetry. Distinct classes (`*BlockIn`)
# rather than aliases so future field divergence between read and write
# (e.g. server-computed fields on the Out side) stays expressible
# without re-typing every call site.


class StartBlockIn(StartBlock, _BlockEnvelopeFields):
    kind: Literal["start"] = "start"


class AppointmentBlockIn(AppointmentBlock, _BlockEnvelopeFields):
    kind: Literal["appointment"] = "appointment"


class TreatmentBlockIn(TreatmentBlock, _BlockEnvelopeFields):
    kind: Literal["treatment"] = "treatment"


class TaskBlockIn(TaskBlock, _BlockEnvelopeFields):
    kind: Literal["task"] = "task"


class DecisionBlockIn(DecisionBlock, _BlockEnvelopeFields):
    kind: Literal["decision"] = "decision"


class MessageBlockIn(MessageBlock, _BlockEnvelopeFields):
    kind: Literal["message"] = "message"


class InformedConsentBlockIn(InformedConsentBlock, _BlockEnvelopeFields):
    kind: Literal["informed_consent"] = "informed_consent"


class MdoBlockIn(MdoBlock, _BlockEnvelopeFields):
    kind: Literal["mdo"] = "mdo"


class FormBlockIn(FormBlock, _BlockEnvelopeFields):
    kind: Literal["form"] = "form"


class PathwayLinkBlockIn(PathwayLinkBlock, _BlockEnvelopeFields):
    kind: Literal["pathway_link"] = "pathway_link"


class ExternalProgramBlockIn(ExternalProgramBlock, _BlockEnvelopeFields):
    kind: Literal["external_program"] = "external_program"


class EndPathwayBlockIn(EndPathwayBlock, _BlockEnvelopeFields):
    kind: Literal["end_pathway"] = "end_pathway"


PathwayTypedBlockIn = Annotated[
    Union[
        StartBlockIn,
        AppointmentBlockIn,
        TreatmentBlockIn,
        TaskBlockIn,
        DecisionBlockIn,
        MessageBlockIn,
        InformedConsentBlockIn,
        MdoBlockIn,
        FormBlockIn,
        PathwayLinkBlockIn,
        ExternalProgramBlockIn,
        EndPathwayBlockIn,
    ],
    Field(discriminator="kind"),
]


__all__ = [
    "AppointmentBlockIn",
    "AppointmentBlockOut",
    "DecisionBlockIn",
    "DecisionBlockOut",
    "EndPathwayBlockIn",
    "EndPathwayBlockOut",
    "ExternalProgramBlockIn",
    "ExternalProgramBlockOut",
    "FormBlockIn",
    "FormBlockOut",
    "InformedConsentBlockIn",
    "InformedConsentBlockOut",
    "MdoBlockIn",
    "MdoBlockOut",
    "MessageBlockIn",
    "MessageBlockOut",
    "PathwayLinkBlockIn",
    "PathwayLinkBlockOut",
    "PathwayTypedBlockIn",
    "PathwayTypedBlockOut",
    "StartBlockIn",
    "StartBlockOut",
    "TaskBlockIn",
    "TaskBlockOut",
    "TreatmentBlockIn",
    "TreatmentBlockOut",
    "out_class_for_kind",
]


# Resolve the `PathwayTypedBlockOut` forward reference declared on
# `PathwayVersionDefinition.blocks` and the wrapping
# `PathwayWithVersionResponse`. The forward reference exists to break the
# package-init cycle between this module and `_base.py` (see the comment
# at the top of this file and the note in `__init__.py`).
from app.domain.pathway.input_logic.derived_edges import DerivedEdge  # noqa: E402
from app.schemas.pathway.pathway import (  # noqa: E402
    PathwayVersionDefinition,
    PathwayWithVersionResponse,
)

_REBUILD_NS = {
    "PathwayTypedBlockOut": PathwayTypedBlockOut,
    "DerivedEdge": DerivedEdge,
}

PathwayVersionDefinition.model_rebuild(_types_namespace=_REBUILD_NS)
PathwayWithVersionResponse.model_rebuild(_types_namespace=_REBUILD_NS)
