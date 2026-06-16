from __future__ import annotations

from app.core.errors import AppError


class AttachmentTooLargeError(AppError):
    code = "invalid.attachment.too_large"
    status_code = 422
    message = "Attachment exceeds the maximum allowed size."


class AttachmentNotFoundError(AppError):
    code = "not-found.attachment.not_found"
    status_code = 404
    message = "Attachment not found."


class AttachmentForbiddenError(AppError):
    code = "forbidden.attachment.not_uploader"
    status_code = 403
    message = "Only the uploader may delete this attachment."
