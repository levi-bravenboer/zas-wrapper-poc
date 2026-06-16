"""DeferredFieldSpec — class-level declaration of fields the builder marks
as supplied at enrollment time rather than at template authoring time.

Decided in `openspec/changes/pathway-model-redesign/design.md` (D4): each
`BaseBlock` subclass declares its deferred fields via a class-level
`DEFERRED_FIELDS` tuple. The spec carries everything the builder needs to
render an enrollment-time form for the value (label, kind, validation, help
text, optional dependency on another deferred field).

The runtime row that holds the *value* a deferred field receives at
enrollment time lives on the `DeferredFieldValue` table introduced in
chain slot #3 (`pathway-runtime-aggregate`). This module owns only the
spec side.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


DeferredFieldKind = Literal[
    "text",
    "long_text",
    "integer",
    "number",
    "boolean",
    "date",
    "datetime",
    "single_choice",
    "multi_choice",
    "file",
]


@dataclass(frozen=True, slots=True)
class DeferredFieldSpec:
    """Builder-time declaration that a subclass field is filled at enrollment.

    Attributes
    ----------
    attr:
        Name of the field on the owning `BaseBlock` subclass whose value is
        supplied at enrollment time. The publish-time validator (see
        `pathway-model-foundations/spec.md`) rejects any spec whose `attr`
        is not a real field on the subclass.
    label:
        Form label shown to the enrolling caregiver. Dutch by convention in
        this codebase; copy lives here, not in the frontend.
    kind:
        Form widget hint and validation primitive. Frontend renders the
        right input control from this; backend validates the value shape
        on save (see chain slot #3).
    required:
        When true, an enrollment cannot transition to `active` without a
        value supplied for this field.
    help:
        Optional helper text rendered below the input.
    default:
        Optional default proposed in the form; user may override.
    depends_on:
        Optional `attr` name of another deferred field on the same block
        that must be filled before this one becomes editable (e.g.
        `scheduled_at` becomes editable only after `mode` is chosen).
    """

    attr: str
    label: str
    kind: DeferredFieldKind
    required: bool = True
    help: str | None = None
    default: Any | None = None
    depends_on: str | None = None
    options: tuple[tuple[str, str], ...] = field(default_factory=tuple)


__all__ = [
    "DeferredFieldKind",
    "DeferredFieldSpec",
]
