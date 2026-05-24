"""Luscii service — picker + resolver for Luscii programs.

Reads from the in-memory `app.adapters.luscii.programs` constant. No DB,
no adapter Protocol slice — this is intentional: with one external vendor
the right abstraction is per-vendor routes (`/luscii/programs`,
`/luscii/programs/{id}`) over a vendor-shaped service. When the live-Luscii
adapter lands it replaces the in-memory constant with a real fetch + cache
layer; the service interface stays unchanged.
"""

from __future__ import annotations

from app.adapters.luscii import (
    LUSCII_STUB_PROGRAMS,
    LUSCII_STUB_PROGRAMS_BY_ID,
    LusciiProgramData,
)
from app.schemas.luscii import LusciiProgramSummary
from app.services.luscii.errors import LusciiProgramNotFoundError


class LusciiService:
    """Stateless service backed by the static stub-program constant.

    Constructed once per request via FastAPI DI; carries no state itself,
    so the alternative of module-level functions would also work — class
    form is kept for symmetry with sibling services and easier future
    injection of a real adapter dependency.
    """

    def list_programs(self) -> list[LusciiProgramSummary]:
        """All available Luscii programs as lightweight picker rows.

        Order is stable: alphabetical by name (matches the picker's
        expected UX of "browse to find one")."""
        rows = [
            LusciiProgramSummary(
                id=program.id,
                name=program.name,
                version=program.version,
                description=program.description,
                enrolled_count_org_wide=program.enrolled_count_org_wide,
            )
            for program in LUSCII_STUB_PROGRAMS
        ]
        rows.sort(key=lambda r: r.name)
        return rows

    def get_program(self, program_id: str) -> LusciiProgramData:
        """Full payload for one Luscii program. Raises if unknown."""
        program = LUSCII_STUB_PROGRAMS_BY_ID.get(program_id)
        if program is None:
            raise LusciiProgramNotFoundError(program_id)
        return program
