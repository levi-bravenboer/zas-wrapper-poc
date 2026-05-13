from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class AppError(Exception):
    """Base class for typed application errors.

    Subclasses set class-level `code`, `status_code`, and `message`.
    Instance-level `details` overrides the class default when provided.
    """

    code: str = "processing.app.error"
    status_code: int = 500
    message: str = "Unexpected application error."
    details: dict[str, Any] | None = None

    def __init__(
        self,
        *,
        message: str | None = None,
        details: dict[str, Any] | None = None,
        code: str | None = None,
        status_code: int | None = None,
    ) -> None:
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        if message is not None:
            self.message = message
        if details is not None:
            self.details = details
        super().__init__(self.message)

    def to_response(self) -> ErrorResponse:
        return ErrorResponse(code=self.code, message=self.message, details=self.details)
