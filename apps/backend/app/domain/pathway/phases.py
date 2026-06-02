"""Phase-template registry.

Default phase templates a pathway can be seeded with (Pre-op → Surgery →
Recovery → Follow-up). Hospitals can replace these in their own pathways;
the templates exist to give the builder a sensible starting point.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PhaseTemplateEntry:
    id: str
    label: str
    default_ord: int
    default_duration_days: int | None = None


PHASE_TEMPLATES: tuple[PhaseTemplateEntry, ...] = (
    PhaseTemplateEntry(id="pre-op", label="Pre-op", default_ord=10, default_duration_days=14),
    PhaseTemplateEntry(id="surgery", label="Surgery", default_ord=20, default_duration_days=1),
    PhaseTemplateEntry(id="recovery", label="Recovery", default_ord=30, default_duration_days=30),
    PhaseTemplateEntry(id="follow-up", label="Follow-up", default_ord=40, default_duration_days=90),
)


_PHASE_TEMPLATES_BY_ID: dict[str, PhaseTemplateEntry] = {p.id: p for p in PHASE_TEMPLATES}


def get_phase_template(template_id: str) -> PhaseTemplateEntry | None:
    return _PHASE_TEMPLATES_BY_ID.get(template_id)


__all__ = [
    "PHASE_TEMPLATES",
    "PhaseTemplateEntry",
    "get_phase_template",
]
