from __future__ import annotations

from app.core.errors import AppError


class SpecialismNotFoundError(AppError):
    code = "not-found.specialism.not_found"
    status_code = 404
    message = "Specialism not found."


class SpecialismCodeTakenError(AppError):
    code = "conflict.specialism.code_taken"
    status_code = 409
    message = "A specialism with this code already exists."


class SpecialismInUseError(AppError):
    code = "conflict.specialism.in_use"
    status_code = 409
    message = "Specialism is linked to roles or carepaths and cannot be removed."
