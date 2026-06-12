"""Resolve a `kind` discriminator (or legacy `type: str`) to the right
`BaseBlock` subclass.

Used during the chain-slot-#1 transition by the storage layer
(SQLAlchemy polymorphic loader) and the write-API compat shim. Once
`BlockTypeEntry` is fully retired and every caller hands us the new
`kind` discriminator, the legacy-alias branch can be removed.
"""

from __future__ import annotations

from app.domain.pathway.blocks.appointment.typed import AppointmentBlock
from app.domain.pathway.blocks.base import BaseBlock, UnknownBlockKindError
from app.domain.pathway.blocks.decision.typed import DecisionBlock
from app.domain.pathway.blocks.end_pathway.typed import EndPathwayBlock
from app.domain.pathway.blocks.form.typed import FormBlock
from app.domain.pathway.blocks.informed_consent.typed import InformedConsentBlock
from app.domain.pathway.blocks.luscii_program.typed import ExternalProgramBlock
from app.domain.pathway.blocks.message.typed import MessageBlock
from app.domain.pathway.blocks.milestone.typed import MilestoneBlock
from app.domain.pathway.blocks.pathway_link.typed import PathwayLinkBlock
from app.domain.pathway.blocks.start.typed import StartBlock
from app.domain.pathway.blocks.task.typed import TaskBlock
from app.domain.pathway.blocks.treatment.typed import TreatmentBlock
from app.domain.pathway.blocks.wait.typed import WaitBlock


BLOCK_CLASSES: tuple[type[BaseBlock], ...] = (
    StartBlock,
    AppointmentBlock,
    TreatmentBlock,
    TaskBlock,
    DecisionBlock,
    MessageBlock,
    InformedConsentBlock,
    FormBlock,
    MilestoneBlock,
    WaitBlock,
    PathwayLinkBlock,
    ExternalProgramBlock,
    EndPathwayBlock,
)


_BY_KIND: dict[str, type[BaseBlock]] = {cls.KIND: cls for cls in BLOCK_CLASSES}

# Legacy `pathway_block.type` codes whose discriminator changed in the
# new model. Maps the wire-string the builder still sends (pre chain
# slot #2) to the new `kind`. The compat shim looks here first; if the
# value is already a new kind, the direct lookup in `_BY_KIND` handles it.
_LEGACY_TYPE_ALIASES: dict[str, str] = {
    "luscii.program": "external_program",
}


def resolve_block_kind(value: str) -> type[BaseBlock]:
    """Return the `BaseBlock` subclass for a kind discriminator or legacy type.

    Raises
    ------
    UnknownBlockKindError
        If the value matches neither a current `kind` nor a legacy alias.
    """
    kind = _LEGACY_TYPE_ALIASES.get(value, value)
    cls = _BY_KIND.get(kind)
    if cls is None:
        raise UnknownBlockKindError(value)
    return cls


def is_external_program_legacy_type(value: str) -> bool:
    """True for legacy dotted types that map to `ExternalProgramBlock`.

    The compat shim uses this to know it must also populate the
    `provider` field on the typed instance (derived from the dotted code).
    """
    return value == "luscii.program"


__all__ = [
    "BLOCK_CLASSES",
    "is_external_program_legacy_type",
    "resolve_block_kind",
]
