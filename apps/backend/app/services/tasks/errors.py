from __future__ import annotations

from app.core.errors import AppError


class TaskNotFoundError(AppError):
    """Raised for both an unknown source segment and a missing/invisible id.

    One error shape on the wire keeps unknown-source vs missing-id
    indistinguishable (existence hiding).
    """

    code = "not-found.task.not_found"
    status_code = 404
    message = "Task not found."
