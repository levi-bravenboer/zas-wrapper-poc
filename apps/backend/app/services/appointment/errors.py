from __future__ import annotations

from app.core.errors import AppError


class AppointmentNotFoundError(AppError):
    code = "not-found.appointment.not_found"
    status_code = 404
    message = "Appointment not found."
