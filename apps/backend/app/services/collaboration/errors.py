from __future__ import annotations

from app.core.errors import AppError


class NoteTooLargeError(AppError):
    code = "invalid.note.file_too_large"
    status_code = 422
    message = "File exceeds the maximum allowed size."


class NoteNotFoundError(AppError):
    code = "not-found.note.not_found"
    status_code = 404
    message = "Note not found."


class NoteForbiddenError(AppError):
    code = "forbidden.note.not_author"
    status_code = 403
    message = "Only the author may delete this note."


class NoteHasNoFileError(AppError):
    code = "invalid.note.no_file"
    status_code = 404
    message = "This note has no file."
