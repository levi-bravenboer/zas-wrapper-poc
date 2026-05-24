from __future__ import annotations

from app.core.errors import AppError


class LusciiProgramNotFoundError(AppError):
    code = "not-found.luscii.program"
    status_code = 404
    message = "Luscii program not found."

    def __init__(self, program_id: str) -> None:
        super().__init__(
            message=self.message,
            details={"program_id": program_id},
        )
