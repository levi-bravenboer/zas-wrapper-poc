from __future__ import annotations

from app.core.errors import AppError


class TaskNotFoundError(AppError):
    code = "not-found.task.not_found"
    status_code = 404
    message = "Task not found."
