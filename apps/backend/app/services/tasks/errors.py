from __future__ import annotations

from app.core.errors import AppError


class UnknownTaskSourceError(AppError):
    code = "not-found.task.unknown_source"
    status_code = 404
    message = "Unknown task source."


class TaskNotFoundError(AppError):
    code = "not-found.task.not_found"
    status_code = 404
    message = "Task not found."
